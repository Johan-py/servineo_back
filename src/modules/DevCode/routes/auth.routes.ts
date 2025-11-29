import { Router } from "express";
import { initiateGoogleLogin, googleCallback, refreshGoogleToken, getCurrentToken, googleSignOut } from "../controllers/oauth.controller";

const router = Router();

router.get("/google-login", initiateGoogleLogin);
router.get("/google-callback", googleCallback);
router.post("/refresh-token", refreshGoogleToken);
router.get("/current-token", getCurrentToken);
router.post("/sign-out", googleSignOut);

export default router;
