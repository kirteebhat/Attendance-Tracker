import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User, IUser, hashPassword } from "../models/User";
import { Employee, IEmployee } from "../models/Employee";
import { RegistrationOtp } from "../models/RegistrationOtp";
import { env } from "../config/env";
import { AppError } from "../utils/AppError";
import { eventEmitterService } from "./eventEmitter.service";
import { ApiErrorCode, UserRole } from "@vorldx/shared";

export interface TokenPayload {
  userId: string;
  employeeId: string;
  email: string;
  role: UserRole;
}

export interface RegisterStartResult {
  employeeId: string;
  email: string;
  expiresInMinutes: number;
  simulatedDemoOtp?: string;
  isDemoMode: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    _id: string;
    employeeId: string;
    email: string;
    role: UserRole;
    status: string;
  };
  employee: {
    _id: string;
    employeeId: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    workType: string;
    shiftId?: string | null;
  } | null;
}

export class AuthService {
  /**
   * Generates a short-lived JWT access token
   */
  public generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    });
  }

  /**
   * Generates a cryptographically secure random refresh token string
   */
  public generateRefreshToken(): string {
    return crypto.randomBytes(40).toString("hex");
  }

  /**
   * Hashes a refresh token with SHA-256 for secure storage
   */
  public hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Authenticates user credentials with lockout protection
   */
  public async login(identifier: string, password: string): Promise<LoginResult> {
    const trimmedId = identifier.trim();
    // Support lookup by uppercase employeeId or lowercase email
    const user = await User.findOne({
      $or: [{ employeeId: trimmedId.toUpperCase() }, { email: trimmedId.toLowerCase() }],
    });

    if (!user) {
      throw AppError.unauthorized("Invalid credentials", ApiErrorCode.ERR_INVALID_CREDENTIALS);
    }

    if (user.status === "INACTIVE") {
      throw AppError.forbidden(
        "Account is disabled. Please contact HR.",
        ApiErrorCode.ERR_FORBIDDEN
      );
    }

    // Check account lockout status
    if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / (60 * 1000));
      throw new AppError(
        423,
        ApiErrorCode.ERR_ACCOUNT_LOCKED,
        `Account is temporarily locked due to repeated failed login attempts. Please try again after ${remainingMinutes} minute(s).`
      );
    }

    // Verify password with bcrypt
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      if (attempts >= env.MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000);
        await User.findByIdAndUpdate(user._id, {
          $set: {
            failedLoginAttempts: attempts,
            lockoutUntil,
          },
        });
        throw new AppError(
          423,
          ApiErrorCode.ERR_ACCOUNT_LOCKED,
          `Account is temporarily locked due to ${env.MAX_LOGIN_ATTEMPTS} consecutive failed login attempts. Please try again after ${env.LOCKOUT_MINUTES} minutes.`
        );
      }

      await User.findByIdAndUpdate(user._id, {
        $set: { failedLoginAttempts: attempts },
      });

      throw AppError.unauthorized("Invalid credentials", ApiErrorCode.ERR_INVALID_CREDENTIALS);
    }

    // Successful authentication: issue tokens and reset failed attempts
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        failedLoginAttempts: 0,
        lockoutUntil: null,
        lastLoginAt: new Date(),
        refreshTokenHash,
      },
    });

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    // Retrieve corresponding employee details if available
    const employee = await Employee.findOne({ employeeId: user.employeeId });

    return {
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      employee: employee
        ? {
            _id: employee._id.toString(),
            employeeId: employee.employeeId,
            name: employee.name,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            workType: employee.workType,
            shiftId: employee.shiftId ? employee.shiftId.toString() : null,
          }
        : null,
    };
  }

  /**
   * Rotates a refresh token and returns a new access token + refresh token
   */
  public async refreshToken(
    providedRefreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!providedRefreshToken) {
      throw AppError.unauthorized("Refresh token is required", ApiErrorCode.ERR_UNAUTHORIZED);
    }

    const hash = this.hashRefreshToken(providedRefreshToken);
    const user = await User.findOne({
      refreshTokenHash: hash,
      status: { $ne: "INACTIVE" },
    });

    if (!user) {
      throw AppError.unauthorized(
        "Invalid or expired refresh token",
        ApiErrorCode.ERR_UNAUTHORIZED
      );
    }

    // Rotate refresh token
    const newRefreshToken = this.generateRefreshToken();
    const newHash = this.hashRefreshToken(newRefreshToken);

    await User.findByIdAndUpdate(user._id, {
      $set: { refreshTokenHash: newHash },
    });

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Invalidates a user's active refresh token upon logout
   */
  public async logout(userId?: string, refreshToken?: string): Promise<void> {
    if (userId) {
      await User.findByIdAndUpdate(userId, { $set: { refreshTokenHash: null } });
    } else if (refreshToken) {
      const hash = this.hashRefreshToken(refreshToken);
      await User.findOneAndUpdate({ refreshTokenHash: hash }, { $set: { refreshTokenHash: null } });
    }
  }

  /**
   * Retrieves current authenticated user profile and associated employee data
   */
  public async getCurrentUser(
    userId: string
  ): Promise<{ user: Partial<IUser>; employee: Partial<IEmployee> | null }> {
    const user = await User.findById(userId).select("-passwordHash -refreshTokenHash");
    if (!user) {
      throw AppError.notFound("User not found", ApiErrorCode.ERR_NOT_FOUND);
    }

    const employee = await Employee.findOne({ employeeId: user.employeeId });

    return {
      user: {
        _id: user._id,
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      employee: employee
        ? {
            _id: employee._id,
            employeeId: employee.employeeId,
            name: employee.name,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            workType: employee.workType,
            shiftId: employee.shiftId,
            joiningDate: employee.joiningDate,
            isActive: employee.isActive,
          }
        : null,
    };
  }

  /**
   * Initiates employee self-registration by generating and securely hashing a 6-digit OTP
   */
  public async startRegistration(employeeId: string): Promise<RegisterStartResult> {
    const normalizedId = employeeId.trim().toUpperCase();
    const employee = await Employee.findOne({ employeeId: normalizedId });

    if (!employee) {
      throw AppError.notFound(
        "Employee ID does not exist in company directory",
        ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND
      );
    }

    if (!employee.isActive) {
      throw new AppError(
        403,
        ApiErrorCode.ERR_EMPLOYEE_INACTIVE,
        "Employee profile is inactive. Please contact Human Resources."
      );
    }

    if (employee.userId) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    const existingUser = await User.findOne({ employeeId: normalizedId });
    if (existingUser) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    // Generate random 6-digit OTP and store only its secure hash
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const hashedCode = await bcrypt.hash(rawOtp, 10);
    const expiresAt = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any previous pending OTP for this employee
    await RegistrationOtp.deleteMany({ employeeId: normalizedId });

    await RegistrationOtp.create({
      employeeId: normalizedId,
      email: employee.email,
      hashedCode,
      expiresAt,
      attempts: 0,
      isUsed: false,
    });

    const isDemoMode = env.NODE_ENV !== "production" && env.DEMO_OTP_MODE === true;

    return {
      employeeId: normalizedId,
      email: employee.email,
      expiresInMinutes: env.OTP_EXPIRY_MINUTES,
      simulatedDemoOtp: isDemoMode ? rawOtp : undefined,
      isDemoMode,
    };
  }

  /**
   * Verifies OTP code, registers the User account, sets password, and logs in the employee
   */
  public async verifyRegistration(
    employeeId: string,
    otp: string,
    password: string
  ): Promise<LoginResult> {
    const normalizedId = employeeId.trim().toUpperCase();
    const employee = await Employee.findOne({ employeeId: normalizedId });

    if (!employee) {
      throw AppError.notFound(
        "Employee ID does not exist in company directory",
        ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND
      );
    }

    if (!employee.isActive) {
      throw new AppError(
        403,
        ApiErrorCode.ERR_EMPLOYEE_INACTIVE,
        "Employee profile is inactive. Please contact Human Resources."
      );
    }

    if (employee.userId) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    const existingUser = await User.findOne({ employeeId: normalizedId });
    if (existingUser) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    // Find active un-used OTP
    const otpRecord = await RegistrationOtp.findOne({ employeeId: normalizedId, isUsed: false });
    if (!otpRecord) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_EXPIRED,
        "Verification code has expired or does not exist. Please request a new code."
      );
    }

    // Check expiration
    if (otpRecord.expiresAt.getTime() <= Date.now()) {
      await RegistrationOtp.deleteOne({ _id: otpRecord._id });
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_EXPIRED,
        "Verification code has expired. Please request a new code."
      );
    }

    // Check attempt limit
    if (otpRecord.attempts >= env.OTP_MAX_ATTEMPTS) {
      await RegistrationOtp.deleteOne({ _id: otpRecord._id });
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_ATTEMPTS_EXCEEDED,
        "Maximum verification attempts exceeded. Please request a new verification code."
      );
    }

    // Verify OTP hash
    const isMatch = await bcrypt.compare(otp.trim(), otpRecord.hashedCode);
    if (!isMatch) {
      const newAttempts = otpRecord.attempts + 1;
      if (newAttempts >= env.OTP_MAX_ATTEMPTS) {
        await RegistrationOtp.deleteOne({ _id: otpRecord._id });
        throw new AppError(
          400,
          ApiErrorCode.ERR_OTP_ATTEMPTS_EXCEEDED,
          "Maximum verification attempts exceeded. Please request a new verification code."
        );
      }

      await RegistrationOtp.updateOne({ _id: otpRecord._id }, { $set: { attempts: newAttempts } });
      const remaining = env.OTP_MAX_ATTEMPTS - newAttempts;
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_OTP,
        `Incorrect verification code. ${remaining} attempt(s) remaining.`
      );
    }

    // Invalidate OTP (single-use)
    await RegistrationOtp.deleteOne({ _id: otpRecord._id });

    // Hash password and create User account
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      employeeId: normalizedId,
      email: employee.email,
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    // Link user ID to employee document
    await Employee.updateOne({ _id: employee._id }, { $set: { userId: user._id } });

    // Issue tokens
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    eventEmitterService.emitEmployeeRegistered({
      employeeId: user.employeeId,
      email: user.email,
      name: employee.name,
      role: user.role,
      status: user.status,
      registeredAt: new Date().toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      employee: {
        _id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        workType: employee.workType,
        shiftId: employee.shiftId ? employee.shiftId.toString() : null,
      },
    };
  }

  /**
   * Validates OTP for Step 2 of multi-screen registration, returning a temporary verification token
   */
  public async validateOtp(
    employeeId: string,
    otp: string
  ): Promise<{ employeeId: string; verificationToken: string; expiresInMinutes: number }> {
    const normalizedId = employeeId.trim().toUpperCase();
    const employee = await Employee.findOne({ employeeId: normalizedId });

    if (!employee) {
      throw AppError.notFound(
        "Employee ID does not exist in company directory",
        ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND
      );
    }

    if (!employee.isActive) {
      throw new AppError(
        403,
        ApiErrorCode.ERR_EMPLOYEE_INACTIVE,
        "Employee profile is inactive. Please contact Human Resources."
      );
    }

    if (employee.userId) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    const existingUser = await User.findOne({ employeeId: normalizedId });
    if (existingUser) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    // Find active un-used OTP
    const otpRecord = await RegistrationOtp.findOne({ employeeId: normalizedId, isUsed: false });
    if (!otpRecord) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_EXPIRED,
        "Verification code has expired or does not exist. Please request a new code."
      );
    }

    // Check expiration
    if (otpRecord.expiresAt.getTime() <= Date.now()) {
      await RegistrationOtp.deleteOne({ _id: otpRecord._id });
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_EXPIRED,
        "Verification code has expired. Please request a new code."
      );
    }

    // Check attempt limit
    if (otpRecord.attempts >= env.OTP_MAX_ATTEMPTS) {
      await RegistrationOtp.deleteOne({ _id: otpRecord._id });
      throw new AppError(
        400,
        ApiErrorCode.ERR_OTP_ATTEMPTS_EXCEEDED,
        "Maximum verification attempts exceeded. Please request a new verification code."
      );
    }

    // Verify OTP hash
    const isMatch = await bcrypt.compare(otp.trim(), otpRecord.hashedCode);
    if (!isMatch) {
      const newAttempts = otpRecord.attempts + 1;
      if (newAttempts >= env.OTP_MAX_ATTEMPTS) {
        await RegistrationOtp.deleteOne({ _id: otpRecord._id });
        throw new AppError(
          400,
          ApiErrorCode.ERR_OTP_ATTEMPTS_EXCEEDED,
          "Maximum verification attempts exceeded. Please request a new verification code."
        );
      }

      await RegistrationOtp.updateOne({ _id: otpRecord._id }, { $set: { attempts: newAttempts } });
      const remaining = env.OTP_MAX_ATTEMPTS - newAttempts;
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_OTP,
        `Incorrect verification code. ${remaining} attempt(s) remaining.`
      );
    }

    // Generate signed verification token valid for 15 minutes
    const verificationToken = jwt.sign(
      { employeeId: normalizedId, purpose: "REGISTRATION_VERIFICATION" },
      env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return {
      employeeId: normalizedId,
      verificationToken,
      expiresInMinutes: 15,
    };
  }

  /**
   * Completes registration using the verification token from Step 2 and sets the password
   */
  public async completeRegistrationWithToken(
    employeeId: string,
    verificationToken: string,
    password: string
  ): Promise<LoginResult> {
    const normalizedId = employeeId.trim().toUpperCase();

    // Verify JWT verification token
    let payload: { employeeId: string; purpose: string };
    try {
      payload = jwt.verify(verificationToken, env.JWT_SECRET) as {
        employeeId: string;
        purpose: string;
      };
    } catch {
      throw new AppError(
        400,
        ApiErrorCode.ERR_VERIFICATION_TOKEN_EXPIRED,
        "Your verification session has expired. Please restart the registration."
      );
    }

    if (payload.purpose !== "REGISTRATION_VERIFICATION" || payload.employeeId !== normalizedId) {
      throw new AppError(
        400,
        ApiErrorCode.ERR_INVALID_INPUT,
        "Invalid verification session. Please restart registration."
      );
    }

    const employee = await Employee.findOne({ employeeId: normalizedId });
    if (!employee) {
      throw AppError.notFound(
        "Employee ID does not exist in company directory",
        ApiErrorCode.ERR_EMPLOYEE_NOT_FOUND
      );
    }

    if (!employee.isActive) {
      throw new AppError(
        403,
        ApiErrorCode.ERR_EMPLOYEE_INACTIVE,
        "Employee profile is inactive. Please contact Human Resources."
      );
    }

    const existingUser = await User.findOne({ employeeId: normalizedId });
    if (existingUser || employee.userId) {
      throw new AppError(
        409,
        ApiErrorCode.ERR_ACCOUNT_ALREADY_REGISTERED,
        "Account is already registered for this Employee ID. Please log in."
      );
    }

    // Invalidate any remaining OTPs
    await RegistrationOtp.deleteMany({ employeeId: normalizedId });

    // Hash password and create User account
    const passwordHash = await hashPassword(password);
    const user = await User.create({
      employeeId: normalizedId,
      email: employee.email,
      passwordHash,
      role: UserRole.EMPLOYEE,
      status: "ACTIVE",
    });

    // Link user ID to employee document
    await Employee.updateOne({ _id: employee._id }, { $set: { userId: user._id } });

    // Issue tokens
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    await User.findByIdAndUpdate(user._id, {
      $set: {
        refreshTokenHash,
        lastLoginAt: new Date(),
      },
    });

    const tokenPayload: TokenPayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(tokenPayload);

    eventEmitterService.emitEmployeeRegistered({
      employeeId: user.employeeId,
      email: user.email,
      name: employee.name,
      role: user.role,
      status: user.status,
      registeredAt: new Date().toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        _id: user._id.toString(),
        employeeId: user.employeeId,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      employee: {
        _id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
        workType: employee.workType,
        shiftId: employee.shiftId ? employee.shiftId.toString() : null,
      },
    };
  }
}

export const authService = new AuthService();
