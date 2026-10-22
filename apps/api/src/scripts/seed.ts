import mongoose from "mongoose";
import { env } from "../config/env";
import { User, hashPassword } from "../models/User";
import { Employee } from "../models/Employee";
import { AttendancePolicy } from "../models/AttendancePolicy";
import { UserRole, WorkType } from "@vorldx/shared";

interface DummyEmployeeSpec {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  workType: WorkType;
  shiftIndex: number;
  joiningDate: string;
}

const DUMMY_EMPLOYEES: DummyEmployeeSpec[] = [
  // 1-8: Engineering
  {
    employeeId: "EMP-1001",
    name: "Aarav Sharma",
    email: "aarav.sharma@vorldx.demo",
    department: "Engineering",
    designation: "Lead Systems Architect",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-01-15",
  },
  {
    employeeId: "EMP-1002",
    name: "Neha Patel",
    email: "neha.patel@vorldx.demo",
    department: "Engineering",
    designation: "Senior Backend Engineer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-03-01",
  },
  {
    employeeId: "EMP-1003",
    name: "Rohan Verma",
    email: "rohan.verma@vorldx.demo",
    department: "Engineering",
    designation: "Frontend Engineer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-06-10",
  },
  {
    employeeId: "EMP-1004",
    name: "Pooja Gupta",
    email: "pooja.gupta@vorldx.demo",
    department: "Engineering",
    designation: "Mobile App Engineer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-08-20",
  },
  {
    employeeId: "EMP-1005",
    name: "Vikram Malhotra",
    email: "vikram.malhotra@vorldx.demo",
    department: "Engineering",
    designation: "DevOps & Cloud Engineer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 1, // Morning Shift
    joiningDate: "2023-11-05",
  },
  {
    employeeId: "EMP-1006",
    name: "Kavita Reddy",
    email: "kavita.reddy@vorldx.demo",
    department: "Engineering",
    designation: "QA Automation Specialist",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2024-01-10",
  },
  {
    employeeId: "EMP-1007",
    name: "Aditya Nair",
    email: "aditya.nair@vorldx.demo",
    department: "Engineering",
    designation: "Data Engineer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2024-02-15",
  },
  {
    employeeId: "EMP-1008",
    name: "Siddharth Joshi",
    email: "siddharth.joshi@vorldx.demo",
    department: "Engineering",
    designation: "Software Engineering Intern",
    workType: WorkType.INTERN,
    shiftIndex: 0,
    joiningDate: "2024-06-01",
  },

  // 9-12: Product & Design
  {
    employeeId: "EMP-2001",
    name: "Isha Kapoor",
    email: "isha.kapoor@vorldx.demo",
    department: "Product",
    designation: "Principal Product Manager",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2022-09-01",
  },
  {
    employeeId: "EMP-2002",
    name: "Kunal Mehra",
    email: "kunal.mehra@vorldx.demo",
    department: "Product",
    designation: "Lead UI/UX Designer",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-04-12",
  },
  {
    employeeId: "EMP-2003",
    name: "Sneha Roy",
    email: "sneha.roy@vorldx.demo",
    department: "Product",
    designation: "Technical Writer & Doc Specialist",
    workType: WorkType.PART_TIME,
    shiftIndex: 0,
    joiningDate: "2023-09-15",
  },
  {
    employeeId: "EMP-2004",
    name: "Tanvi Saxena",
    email: "tanvi.saxena@vorldx.demo",
    department: "Product",
    designation: "Product Design Intern",
    workType: WorkType.INTERN,
    shiftIndex: 0,
    joiningDate: "2024-05-15",
  },

  // 13-15: Human Resources
  {
    employeeId: "EMP-3001",
    name: "Priyanka Deshmukh",
    email: "priyanka.deshmukh@vorldx.demo",
    department: "Human Resources",
    designation: "Senior HR Specialist",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2022-11-01",
  },
  {
    employeeId: "EMP-3002",
    name: "Deepak Choudhury",
    email: "deepak.choudhury@vorldx.demo",
    department: "Human Resources",
    designation: "Talent Acquisition Partner",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-07-10",
  },
  {
    employeeId: "EMP-3003",
    name: "Meera Bhatia",
    email: "meera.bhatia@vorldx.demo",
    department: "Human Resources",
    designation: "HR Operations Associate",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2024-01-20",
  },

  // 16-19: Marketing & Growth
  {
    employeeId: "EMP-4001",
    name: "Varun Singhal",
    email: "varun.singhal@vorldx.demo",
    department: "Marketing",
    designation: "Head of Growth Marketing",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2022-10-15",
  },
  {
    employeeId: "EMP-4002",
    name: "Ritu Sengupta",
    email: "ritu.sengupta@vorldx.demo",
    department: "Marketing",
    designation: "Content & Communications Lead",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-05-01",
  },
  {
    employeeId: "EMP-4003",
    name: "Akash Mishra",
    email: "akash.mishra@vorldx.demo",
    department: "Marketing",
    designation: "SEO & Performance Specialist",
    workType: WorkType.CONTRACT,
    shiftIndex: 0,
    joiningDate: "2023-10-01",
  },
  {
    employeeId: "EMP-4004",
    name: "Divya Nambiar",
    email: "divya.nambiar@vorldx.demo",
    department: "Marketing",
    designation: "Community & Social Lead",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2024-03-01",
  },

  // 20-25: Operations & Support
  {
    employeeId: "EMP-5001",
    name: "Gaurav Kulkarni",
    email: "gaurav.kulkarni@vorldx.demo",
    department: "Operations",
    designation: "Operations General Manager",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2022-08-01",
  },
  {
    employeeId: "EMP-5002",
    name: "Shweta Tiwari",
    email: "shweta.tiwari@vorldx.demo",
    department: "Operations",
    designation: "Office Experience & Admin Lead",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-02-15",
  },
  {
    employeeId: "EMP-5003",
    name: "Manish Agarwal",
    email: "manish.agarwal@vorldx.demo",
    department: "Operations",
    designation: "IT Support Specialist",
    workType: WorkType.FULL_TIME,
    shiftIndex: 1, // Morning Shift
    joiningDate: "2023-08-10",
  },
  {
    employeeId: "EMP-5004",
    name: "Preeti Rao",
    email: "preeti.rao@vorldx.demo",
    department: "Operations",
    designation: "Customer Success Lead",
    workType: WorkType.FULL_TIME,
    shiftIndex: 0,
    joiningDate: "2023-12-01",
  },
  {
    employeeId: "EMP-5005",
    name: "Rajesh Kannan",
    email: "rajesh.kannan@vorldx.demo",
    department: "Operations",
    designation: "Night Operations Specialist",
    workType: WorkType.FULL_TIME,
    shiftIndex: 2, // Night Shift
    joiningDate: "2024-01-15",
  },
  {
    employeeId: "EMP-5006",
    name: "Anjali Saxena",
    email: "anjali.saxena@vorldx.demo",
    department: "Operations",
    designation: "Customer Support Executive",
    workType: WorkType.CONTRACT,
    shiftIndex: 2, // Night Shift
    joiningDate: "2024-04-01",
  },
];

export async function runSeed(): Promise<void> {
  console.log("🌱 Starting database seed script...");

  // 1. Production safety verification: Refuse to run with demo/default credentials
  if (process.env.NODE_ENV === "production") {
    const demoInsecurePasswords = [
      "Admin@VorldX2026!",
      "Hr@VorldX2026!",
      "Employee@2026!",
      "demo",
      "admin",
      "password",
      "123456",
    ];

    const adminPass = process.env.ADMIN_DEFAULT_PASSWORD;
    const hrPass = process.env.HR_DEFAULT_PASSWORD;

    if (!adminPass || demoInsecurePasswords.includes(adminPass)) {
      throw new Error(
        "FATAL: Refusing to seed production database! ADMIN_DEFAULT_PASSWORD must be explicitly provided and cannot use default demo credentials in production."
      );
    }

    if (!hrPass || demoInsecurePasswords.includes(hrPass)) {
      throw new Error(
        "FATAL: Refusing to seed production database! HR_DEFAULT_PASSWORD must be explicitly provided and cannot use default demo credentials in production."
      );
    }
  }

  // 2. Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
    console.log(` Connected to MongoDB: ${mongoose.connection.name}`);
  }

  // 3. Ensure Default Attendance Policy and Shifts exist
  let policy = await AttendancePolicy.findOne({ isDefault: true });
  if (!policy) {
    policy = await AttendancePolicy.create({
      name: "Standard Corporate Attendance Policy",
      timezone: env.DEFAULT_TIMEZONE,
      defaultGraceMinutes: 15,
      minFullDayHours: 8,
      minHalfDayHours: 4,
      monthlyWfhQuota: 4,
      qrRotationSeconds: env.QR_ROTATION_SECONDS,
      qrGraceSeconds: env.QR_GRACE_SECONDS,
      punchCooldownMinutes: 2,
      allowOvertime: false,
      workdays: [1, 2, 3, 4, 5], // Monday - Friday
      shifts: [
        {
          name: "General Day Shift",
          startTime: "09:30",
          endTime: "18:30",
          graceMinutes: 15,
          isOvernight: false,
          isActive: true,
        },
        {
          name: "Early Morning Shift",
          startTime: "07:00",
          endTime: "16:00",
          graceMinutes: 15,
          isOvernight: false,
          isActive: true,
        },
        {
          name: "Night Operations Shift",
          startTime: "21:00",
          endTime: "06:00",
          graceMinutes: 15,
          isOvernight: true,
          isActive: true,
        },
      ],
      isDefault: true,
    });
    console.log(" Created default Attendance Policy with 3 shifts (Day, Morning, Night).");
  } else {
    console.log(` Found existing Attendance Policy: ${policy.name}`);
  }

  const shiftIds = policy.shifts.map((s) => s._id);

  // 4. Seed Demo Admin User
  const adminPassword = env.ADMIN_DEFAULT_PASSWORD;
  const adminPasswordHash = await hashPassword(adminPassword);

  let adminUser = await User.findOne({ employeeId: "ADM-001" });
  if (!adminUser) {
    adminUser = await User.create({
      employeeId: "ADM-001",
      email: "admin@vorldx.demo",
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      status: "ACTIVE",
    });
    console.log(" Created Demo Admin user: ADM-001 (admin@vorldx.demo)");
  } else {
    adminUser.passwordHash = adminPasswordHash;
    adminUser.role = UserRole.ADMIN;
    adminUser.status = "ACTIVE";
    await adminUser.save();
    console.log(" Updated Demo Admin user: ADM-001");
  }

  await Employee.findOneAndUpdate(
    { employeeId: "ADM-001" },
    {
      $set: {
        employeeId: "ADM-001",
        name: "System Administrator",
        email: "admin@vorldx.demo",
        department: "Executive",
        designation: "Platform Super Admin",
        workType: WorkType.FULL_TIME,
        shiftId: shiftIds[0],
        joiningDate: "2022-01-01",
        isActive: true,
        userId: adminUser._id,
      },
    },
    { upsert: true, new: true }
  );

  // 5. Seed Demo HR User
  const hrPassword = env.HR_DEFAULT_PASSWORD;
  const hrPasswordHash = await hashPassword(hrPassword);

  let hrUser = await User.findOne({ employeeId: "HR-001" });
  if (!hrUser) {
    hrUser = await User.create({
      employeeId: "HR-001",
      email: "hr@vorldx.demo",
      passwordHash: hrPasswordHash,
      role: UserRole.HR,
      status: "ACTIVE",
    });
    console.log(" Created Demo HR user: HR-001 (hr@vorldx.demo)");
  } else {
    hrUser.passwordHash = hrPasswordHash;
    hrUser.role = UserRole.HR;
    hrUser.status = "ACTIVE";
    await hrUser.save();
    console.log(" Updated Demo HR user: HR-001");
  }

  await Employee.findOneAndUpdate(
    { employeeId: "HR-001" },
    {
      $set: {
        employeeId: "HR-001",
        name: "Ananya Sharma",
        email: "hr@vorldx.demo",
        department: "Human Resources",
        designation: "HR Lead & People Ops",
        workType: WorkType.FULL_TIME,
        shiftId: shiftIds[0],
        joiningDate: "2022-06-01",
        isActive: true,
        userId: hrUser._id,
      },
    },
    { upsert: true, new: true }
  );

  // 6. Seed 25 Dummy Employees
  const employeePassword = env.EMPLOYEE_DEFAULT_PASSWORD;
  const employeePasswordHash = await hashPassword(employeePassword);

  let createdCount = 0;
  for (const empData of DUMMY_EMPLOYEES) {
    const assignedShiftId = shiftIds[empData.shiftIndex] || shiftIds[0];

    // Upsert User
    let empUser = await User.findOne({ employeeId: empData.employeeId });
    if (!empUser) {
      empUser = await User.create({
        employeeId: empData.employeeId,
        email: empData.email,
        passwordHash: employeePasswordHash,
        role: UserRole.EMPLOYEE,
        status: "ACTIVE",
      });
    } else {
      empUser.passwordHash = employeePasswordHash;
      empUser.role = UserRole.EMPLOYEE;
      empUser.status = "ACTIVE";
      await empUser.save();
    }

    // Upsert Employee
    await Employee.findOneAndUpdate(
      { employeeId: empData.employeeId },
      {
        $set: {
          employeeId: empData.employeeId,
          name: empData.name,
          email: empData.email,
          department: empData.department,
          designation: empData.designation,
          workType: empData.workType,
          shiftId: assignedShiftId,
          joiningDate: empData.joiningDate,
          isActive: true,
          userId: empUser._id,
        },
      },
      { upsert: true, new: true }
    );

    createdCount++;
  }

  console.log(` Created/Updated ${createdCount} realistic dummy employees across 5 departments.`);
  console.log(" Seeding completed successfully!");
}

// Run directly if invoked as script
if (
  require.main === module ||
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  runSeed()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("❌ Fatal Seeding Error:", error);
      await mongoose.disconnect();
      process.exit(1);
    });
}
