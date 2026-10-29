import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { LeaveType } from "../apps/api/src/models/LeaveType";
import { FeatureFlag } from "../apps/api/src/models/FeatureFlag";

// Load environment variables from apps/api/.env if present
const envPath = path.resolve(__dirname, "../apps/api/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/vorldx_attendance";

const DEFAULT_LEAVE_TYPES = [
  {
    code: "CL",
    name: "Casual Leave",
    annualQuota: 12,
    paid: true,
    carryForwardRule: { allowed: false, maxDays: 0 },
    halfDayAllowed: true,
    description: "Urgent personal affairs and short-notice time off",
    isActive: true,
  },
  {
    code: "SL",
    name: "Sick Leave",
    annualQuota: 10,
    paid: true,
    carryForwardRule: { allowed: true, maxDays: 5, expiryMonths: 12 },
    halfDayAllowed: true,
    description: "Medical recuperation and healthcare appointments",
    isActive: true,
  },
  {
    code: "AL",
    name: "Annual Leave",
    annualQuota: 15,
    paid: true,
    carryForwardRule: { allowed: true, maxDays: 10, expiryMonths: 12 },
    halfDayAllowed: false,
    description: "Privileged earned annual vacation and rest",
    isActive: true,
  },
  {
    code: "EL",
    name: "Earned Leave",
    annualQuota: 18,
    paid: true,
    carryForwardRule: { allowed: true, maxDays: 15, expiryMonths: 12 },
    halfDayAllowed: false,
    description: "Privileged earned time off",
    isActive: true,
  },
  {
    code: "ML",
    name: "Maternity/Paternity",
    annualQuota: 84,
    paid: true,
    carryForwardRule: { allowed: false, maxDays: 0 },
    halfDayAllowed: false,
    description: "Parental and child-care leave",
    isActive: true,
  },
  {
    code: "UL",
    name: "Unpaid Leave (LWP)",
    annualQuota: 30,
    paid: false,
    carryForwardRule: { allowed: false, maxDays: 0 },
    halfDayAllowed: true,
    description: "Leave without pay approved by management",
    isActive: true,
  },
];

async function seedLeaveTypes() {
  console.log(`Connecting to MongoDB at: ${MONGODB_URI}...`);
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB successfully!");

  // 1. Ensure Feature Flag is Enabled
  await FeatureFlag.findOneAndUpdate(
    { key: "leave" },
    {
      $set: {
        key: "leave",
        enabled: true,
        description: "Employee leave balances, requests, and HR approval queue",
      },
    },
    { upsert: true, new: true }
  );
  console.log("Verified 'leave' feature flag is ENABLED.");

  // 2. Seed / Upsert Leave Types
  console.log("Seeding standard corporate Leave Types...");
  for (const item of DEFAULT_LEAVE_TYPES) {
    const existing = await LeaveType.findOne({ code: item.code });
    if (!existing) {
      const created = await LeaveType.create(item);
      console.log(` Created LeaveType [${created.code}] "${created.name}" (ID: ${created._id})`);
    } else {
      existing.name = item.name;
      existing.annualQuota = item.annualQuota;
      existing.paid = item.paid;
      existing.carryForwardRule = item.carryForwardRule;
      existing.halfDayAllowed = item.halfDayAllowed;
      existing.description = item.description;
      existing.isActive = true;
      await existing.save();
      console.log(` Updated LeaveType [${existing.code}] "${existing.name}" (ID: ${existing._id})`);
    }
  }

  const allTypes = await LeaveType.find({ isActive: true });
  console.log(`\nActive Leave Types in Database (${allTypes.length}):`);
  allTypes.forEach((t) => {
    console.log(` - [${t.code}] ${t.name}: ${t.annualQuota} days/yr (Paid: ${t.paid}, ID: ${t._id})`);
  });

  await mongoose.disconnect();
  console.log("\nDisconnected from MongoDB. Seeding completed successfully!");
}

seedLeaveTypes().catch(async (err) => {
  console.error("Seeding error:", err);
  await mongoose.disconnect();
  process.exit(1);
});

