import { z } from "zod";
export declare const WfhRulesSchema: z.ZodObject<{
    monthlyQuota: z.ZodDefault<z.ZodNumber>;
    advanceNoticeDays: z.ZodDefault<z.ZodNumber>;
    allowedDaysPerWeek: z.ZodDefault<z.ZodNumber>;
    autoApproval: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    monthlyQuota: number;
    advanceNoticeDays: number;
    allowedDaysPerWeek: number;
    autoApproval: boolean;
}, {
    monthlyQuota?: number | undefined;
    advanceNoticeDays?: number | undefined;
    allowedDaysPerWeek?: number | undefined;
    autoApproval?: boolean | undefined;
}>;
export type WfhRules = z.infer<typeof WfhRulesSchema>;
export declare const ShiftSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    name: z.ZodString;
    startTime: z.ZodString;
    endTime: z.ZodString;
    graceMinutes: z.ZodDefault<z.ZodNumber>;
    checkInWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
    checkInWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
    checkOutWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
    checkOutWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
    isOvernight: z.ZodDefault<z.ZodBoolean>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes: number;
    isActive: boolean;
    checkInWindowStartMinutes: number;
    checkInWindowEndMinutes: number;
    checkOutWindowStartMinutes: number;
    checkOutWindowEndMinutes: number;
    isOvernight: boolean;
    _id?: string | undefined;
}, {
    name: string;
    startTime: string;
    endTime: string;
    _id?: string | undefined;
    graceMinutes?: number | undefined;
    isActive?: boolean | undefined;
    checkInWindowStartMinutes?: number | undefined;
    checkInWindowEndMinutes?: number | undefined;
    checkOutWindowStartMinutes?: number | undefined;
    checkOutWindowEndMinutes?: number | undefined;
    isOvernight?: boolean | undefined;
}>;
export type Shift = z.infer<typeof ShiftSchema>;
export declare const AttendancePolicySchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    name: z.ZodDefault<z.ZodString>;
    version: z.ZodDefault<z.ZodNumber>;
    timezone: z.ZodDefault<z.ZodString>;
    defaultGraceMinutes: z.ZodDefault<z.ZodNumber>;
    minFullDayHours: z.ZodDefault<z.ZodNumber>;
    minHalfDayHours: z.ZodDefault<z.ZodNumber>;
    monthlyWfhQuota: z.ZodDefault<z.ZodNumber>;
    absenceEvaluationCutoffTime: z.ZodDefault<z.ZodString>;
    workdays: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    wfhRules: z.ZodDefault<z.ZodObject<{
        monthlyQuota: z.ZodDefault<z.ZodNumber>;
        advanceNoticeDays: z.ZodDefault<z.ZodNumber>;
        allowedDaysPerWeek: z.ZodDefault<z.ZodNumber>;
        autoApproval: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        monthlyQuota: number;
        advanceNoticeDays: number;
        allowedDaysPerWeek: number;
        autoApproval: boolean;
    }, {
        monthlyQuota?: number | undefined;
        advanceNoticeDays?: number | undefined;
        allowedDaysPerWeek?: number | undefined;
        autoApproval?: boolean | undefined;
    }>>;
    shifts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        _id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
        graceMinutes: z.ZodDefault<z.ZodNumber>;
        checkInWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
        checkInWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
        checkOutWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
        checkOutWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
        isOvernight: z.ZodDefault<z.ZodBoolean>;
        isActive: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
        isActive: boolean;
        checkInWindowStartMinutes: number;
        checkInWindowEndMinutes: number;
        checkOutWindowStartMinutes: number;
        checkOutWindowEndMinutes: number;
        isOvernight: boolean;
        _id?: string | undefined;
    }, {
        name: string;
        startTime: string;
        endTime: string;
        _id?: string | undefined;
        graceMinutes?: number | undefined;
        isActive?: boolean | undefined;
        checkInWindowStartMinutes?: number | undefined;
        checkInWindowEndMinutes?: number | undefined;
        checkOutWindowStartMinutes?: number | undefined;
        checkOutWindowEndMinutes?: number | undefined;
        isOvernight?: boolean | undefined;
    }>, "many">>;
    qrRotationSeconds: z.ZodDefault<z.ZodNumber>;
    qrGraceSeconds: z.ZodDefault<z.ZodNumber>;
    punchCooldownMinutes: z.ZodDefault<z.ZodNumber>;
    allowOvertime: z.ZodDefault<z.ZodBoolean>;
    isDefault: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    version: number;
    timezone: string;
    defaultGraceMinutes: number;
    minFullDayHours: number;
    minHalfDayHours: number;
    monthlyWfhQuota: number;
    absenceEvaluationCutoffTime: string;
    workdays: number[];
    wfhRules: {
        monthlyQuota: number;
        advanceNoticeDays: number;
        allowedDaysPerWeek: number;
        autoApproval: boolean;
    };
    shifts: {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
        isActive: boolean;
        checkInWindowStartMinutes: number;
        checkInWindowEndMinutes: number;
        checkOutWindowStartMinutes: number;
        checkOutWindowEndMinutes: number;
        isOvernight: boolean;
        _id?: string | undefined;
    }[];
    qrRotationSeconds: number;
    qrGraceSeconds: number;
    punchCooldownMinutes: number;
    allowOvertime: boolean;
    isDefault: boolean;
    _id?: string | undefined;
}, {
    _id?: string | undefined;
    name?: string | undefined;
    version?: number | undefined;
    timezone?: string | undefined;
    defaultGraceMinutes?: number | undefined;
    minFullDayHours?: number | undefined;
    minHalfDayHours?: number | undefined;
    monthlyWfhQuota?: number | undefined;
    absenceEvaluationCutoffTime?: string | undefined;
    workdays?: number[] | undefined;
    wfhRules?: {
        monthlyQuota?: number | undefined;
        advanceNoticeDays?: number | undefined;
        allowedDaysPerWeek?: number | undefined;
        autoApproval?: boolean | undefined;
    } | undefined;
    shifts?: {
        name: string;
        startTime: string;
        endTime: string;
        _id?: string | undefined;
        graceMinutes?: number | undefined;
        isActive?: boolean | undefined;
        checkInWindowStartMinutes?: number | undefined;
        checkInWindowEndMinutes?: number | undefined;
        checkOutWindowStartMinutes?: number | undefined;
        checkOutWindowEndMinutes?: number | undefined;
        isOvernight?: boolean | undefined;
    }[] | undefined;
    qrRotationSeconds?: number | undefined;
    qrGraceSeconds?: number | undefined;
    punchCooldownMinutes?: number | undefined;
    allowOvertime?: boolean | undefined;
    isDefault?: boolean | undefined;
}>;
export type AttendancePolicy = z.infer<typeof AttendancePolicySchema>;
export declare const PolicyUpdateSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    name: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    version: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    timezone: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    defaultGraceMinutes: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    minFullDayHours: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    minHalfDayHours: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    monthlyWfhQuota: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    absenceEvaluationCutoffTime: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    workdays: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>>;
    wfhRules: z.ZodOptional<z.ZodDefault<z.ZodObject<{
        monthlyQuota: z.ZodDefault<z.ZodNumber>;
        advanceNoticeDays: z.ZodDefault<z.ZodNumber>;
        allowedDaysPerWeek: z.ZodDefault<z.ZodNumber>;
        autoApproval: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        monthlyQuota: number;
        advanceNoticeDays: number;
        allowedDaysPerWeek: number;
        autoApproval: boolean;
    }, {
        monthlyQuota?: number | undefined;
        advanceNoticeDays?: number | undefined;
        allowedDaysPerWeek?: number | undefined;
        autoApproval?: boolean | undefined;
    }>>>;
    shifts: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodObject<{
        _id: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        startTime: z.ZodString;
        endTime: z.ZodString;
        graceMinutes: z.ZodDefault<z.ZodNumber>;
        checkInWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
        checkInWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
        checkOutWindowStartMinutes: z.ZodDefault<z.ZodNumber>;
        checkOutWindowEndMinutes: z.ZodDefault<z.ZodNumber>;
        isOvernight: z.ZodDefault<z.ZodBoolean>;
        isActive: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
        isActive: boolean;
        checkInWindowStartMinutes: number;
        checkInWindowEndMinutes: number;
        checkOutWindowStartMinutes: number;
        checkOutWindowEndMinutes: number;
        isOvernight: boolean;
        _id?: string | undefined;
    }, {
        name: string;
        startTime: string;
        endTime: string;
        _id?: string | undefined;
        graceMinutes?: number | undefined;
        isActive?: boolean | undefined;
        checkInWindowStartMinutes?: number | undefined;
        checkInWindowEndMinutes?: number | undefined;
        checkOutWindowStartMinutes?: number | undefined;
        checkOutWindowEndMinutes?: number | undefined;
        isOvernight?: boolean | undefined;
    }>, "many">>>;
    qrRotationSeconds: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    qrGraceSeconds: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    punchCooldownMinutes: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    allowOvertime: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    isDefault: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
} & {
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    _id?: string | undefined;
    name?: string | undefined;
    reason?: string | undefined;
    version?: number | undefined;
    timezone?: string | undefined;
    defaultGraceMinutes?: number | undefined;
    minFullDayHours?: number | undefined;
    minHalfDayHours?: number | undefined;
    monthlyWfhQuota?: number | undefined;
    absenceEvaluationCutoffTime?: string | undefined;
    workdays?: number[] | undefined;
    wfhRules?: {
        monthlyQuota: number;
        advanceNoticeDays: number;
        allowedDaysPerWeek: number;
        autoApproval: boolean;
    } | undefined;
    shifts?: {
        name: string;
        startTime: string;
        endTime: string;
        graceMinutes: number;
        isActive: boolean;
        checkInWindowStartMinutes: number;
        checkInWindowEndMinutes: number;
        checkOutWindowStartMinutes: number;
        checkOutWindowEndMinutes: number;
        isOvernight: boolean;
        _id?: string | undefined;
    }[] | undefined;
    qrRotationSeconds?: number | undefined;
    qrGraceSeconds?: number | undefined;
    punchCooldownMinutes?: number | undefined;
    allowOvertime?: boolean | undefined;
    isDefault?: boolean | undefined;
}, {
    _id?: string | undefined;
    name?: string | undefined;
    reason?: string | undefined;
    version?: number | undefined;
    timezone?: string | undefined;
    defaultGraceMinutes?: number | undefined;
    minFullDayHours?: number | undefined;
    minHalfDayHours?: number | undefined;
    monthlyWfhQuota?: number | undefined;
    absenceEvaluationCutoffTime?: string | undefined;
    workdays?: number[] | undefined;
    wfhRules?: {
        monthlyQuota?: number | undefined;
        advanceNoticeDays?: number | undefined;
        allowedDaysPerWeek?: number | undefined;
        autoApproval?: boolean | undefined;
    } | undefined;
    shifts?: {
        name: string;
        startTime: string;
        endTime: string;
        _id?: string | undefined;
        graceMinutes?: number | undefined;
        isActive?: boolean | undefined;
        checkInWindowStartMinutes?: number | undefined;
        checkInWindowEndMinutes?: number | undefined;
        checkOutWindowStartMinutes?: number | undefined;
        checkOutWindowEndMinutes?: number | undefined;
        isOvernight?: boolean | undefined;
    }[] | undefined;
    qrRotationSeconds?: number | undefined;
    qrGraceSeconds?: number | undefined;
    punchCooldownMinutes?: number | undefined;
    allowOvertime?: boolean | undefined;
    isDefault?: boolean | undefined;
}>;
export type PolicyUpdate = z.infer<typeof PolicyUpdateSchema>;
export declare const HolidayCreateSchema: z.ZodObject<{
    name: z.ZodString;
    dateKey: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    isRecurring: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    dateKey: string;
    isRecurring: boolean;
    description?: string | undefined;
}, {
    name: string;
    dateKey: string;
    description?: string | undefined;
    isRecurring?: boolean | undefined;
}>;
export type HolidayCreate = z.infer<typeof HolidayCreateSchema>;
export declare const HolidayUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    dateKey: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    isRecurring: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    dateKey?: string | undefined;
    description?: string | undefined;
    isRecurring?: boolean | undefined;
}, {
    name?: string | undefined;
    dateKey?: string | undefined;
    description?: string | undefined;
    isRecurring?: boolean | undefined;
}>;
export type HolidayUpdate = z.infer<typeof HolidayUpdateSchema>;
//# sourceMappingURL=policy.d.ts.map