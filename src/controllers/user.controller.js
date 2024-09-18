import { asyncHandler } from "../utilis/asyncHandler.js";
import { ApiError } from "../utilis/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utilis/cloudinary.js";
import { ApiResponse } from "../utilis/apiResponse.js";
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
  const existingUser = User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User with email or username already exists");
  }
  const avatarLocalPath = req?.files?.avatar[0]?.path;
  const coverImageLocalPath = req?.files?.coverImage[0]?.path;

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

  // return new ApiResponse(200, createdUser, "user created scuccessfully", true);

  return res
    .status(201)
    .json(
      new ApiResponse(200, createdUser, "user created scuccessfully", true)
    );
});

export { registerUser };
