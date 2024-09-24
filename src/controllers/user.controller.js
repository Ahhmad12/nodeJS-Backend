import { asyncHandler } from "../utilis/asyncHandler.js";
import { ApiError } from "../utilis/apiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleleImageOnCloudinary,
} from "../utilis/cloudinary.js";
import { ApiResponse } from "../utilis/apiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generate refresh and access tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user detail from FE
  // validation - not empty
  // check if user is already exist : username, email
  // check for images , check for avatar
  // upload them on cloudinary, avatar
  // create user object, create entry in db
  // remove password and refresh token from object
  // check for user creation
  // return res

  const { fullName, email, password, username } = req.body;
  if (
    [fullName, email, password, username].some((fields) => fields?.trim() == "")
  ) {
    throw new ApiError(400, "All Fields are required");
  }
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  const avatarLocalPath = req?.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.fields.coverImage.length > 0
  ) {
    coverImageLocalPath = req?.files?.coverImage[0]?.path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(409, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    email,
    username: username?.toLowerCase(),
    password,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(200, createdUser, "user created scuccessfully", true)
    );
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body - data
  // username or email
  // find user
  // check password
  // access and refresh token generate
  // send cookies

  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "username or email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "user logged in successfully",
        true
      )
    );
});

const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id).select();

    if (!user) {
      throw new ApiError(401, "Inavlid user request");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user?._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed successfully",
          true
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invlaid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req?.user?._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const password = await user.isPasswordCorrect(oldPassword);
  if (!password) {
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully", true));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const { password, refreshToken, ...userWithoutPassword } =
    req.user._doc || req.user;

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        userWithoutPassword,
        "Current user fetched successfully",
        true
      )
    );
});

const updateAccountHandler = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "user updated successfully", true));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.files?.avatar[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiError(409, "Avatar file is missing");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(409, "Error while uploading a avatar");
  }

  await deleleImageOnCloudinary(avatarLocalPath);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, user, "User avatar is updated successfully", true)
    );
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverLocalPath = req.files?.coverImage?.[0].path;

  if (!coverLocalPath) {
    throw new ApiError(409, "Cover Image file is missing");
  }
  const coverImage = await uploadOnCloudinary(coverLocalPath);

  if (!coverImage.url) {
    throw new ApiError(409, "Error while uploading a cover Imgae");
  }
  await deleleImageOnCloudinary(coverLocalPath);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user,
        "User cover image is updated successfully",
        true
      )
    );
});

const getUserChannelDetail = asyncHandler(async (req, res) => {
  console.log(req.params);
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "user name is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subcripbersCount: {
          $size: "$subscribers",
        },
        subscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req?.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subcripbersCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel.length) {
    throw new ApiError(404, "Channel not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        channel[0],
        "User channel fetched successfully",
        true
      )
    );
});

export {
  registerUser,
  loginUser,
  logout,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountHandler,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelDetail,
};
