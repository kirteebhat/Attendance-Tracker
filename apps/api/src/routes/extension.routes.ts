import { Router, Request, Response } from "express";
import { requireFeatureFlag } from "../middleware/featureFlag";
import { authenticate } from "../middleware/auth";

const router = Router();

// 1. Leave Requests and Approvals Module
router.use("/leave", requireFeatureFlag("leave"));
router.get("/leave/requests", authenticate, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "leave",
    status: "ACTIVE",
    data: [],
    message: "Leave requests and approvals module is enabled.",
  });
});

// 2. Announcements & Auto-Generated Broadcasts Module
router.use("/announcements", requireFeatureFlag("announcements"));
router.get("/announcements", authenticate, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "announcements",
    status: "ACTIVE",
    data: [],
    message: "Announcements module is enabled.",
  });
});

// 3. Enquiry Requests & Dispute Resolution Module
router.use("/enquiries", requireFeatureFlag("enquiries"));
router.get("/enquiries", authenticate, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "enquiries",
    status: "ACTIVE",
    data: [],
    message: "Enquiries module is enabled.",
  });
});

// 4. Working Calendar & Public Holidays Import Module
router.use("/calendar/import", requireFeatureFlag("calendarImport"));
router.post("/calendar/import", authenticate, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "calendarImport",
    status: "ACTIVE",
    message: "Calendar import module is enabled.",
  });
});

// 5. 3D / Advanced Spatial Workforce Visualizer Module
router.use("/three-d", requireFeatureFlag("threeD"));
router.get("/three-d/config", authenticate, (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "threeD",
    status: "ACTIVE",
    message: "3D visualization module is enabled.",
  });
});

// 6. One-Click Over-The-Air (OTA) Updates Module
router.use("/ota", requireFeatureFlag("otaUpdates"));
router.get("/ota/manifest", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    module: "otaUpdates",
    status: "ACTIVE",
    version: "1.0.0",
    updateAvailable: false,
    message: "OTA updates module is enabled.",
  });
});

export default router;
