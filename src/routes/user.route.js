import { Router } from "express";
import {
  loginUser,
  registerUser,
  logout,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountHandler,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelDetail,
  getUserWatchHistory,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

// auth
router.route("/login").post(loginUser);

// secured routes
router.route("/logout").post(verifyJWT, logout);
router.route("/refreshToken").post(refreshAccessToken);

// get user
router.route("/getUser").get(verifyJWT, getCurrentUser);
router.route("/getUserChannel/:username").get(verifyJWT, getUserChannelDetail);

// get user watch history
router.route("/watchHistory").get(verifyJWT, getUserWatchHistory);

// update user account
router.route("/changePassword").post(verifyJWT, changeCurrentPassword);
router.route("/updateUser").put(verifyJWT, updateAccountHandler);
router.route("/updateAvatar").patch(
  verifyJWT,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  updateUserAvatar
);

router.route("/updateCoverImage").patch(
  verifyJWT,
  upload.fields([
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  updateUserCoverImage
);

export default router;
