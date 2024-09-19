import { asyncHandler } from "../utilis/asyncHandler.js";
import { ApiError } from "../utilis/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utilis/cloudinary.js";
import { ApiResponse } from "../utilis/apiResponse.js";

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
    .clearCookie("accessToken")
    .clearCookie("refreshToken")
    .json(new ApiResponse(200, {}, "user logged out"));
});

export { registerUser, loginUser, logout };
