import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/apiResponse.js";
const registerUser = asyncHandler(async (req, res) => {
  // get user details from front end
  // Validation - not empty
  // check if user is already exist: username email
  // check for images, check for avatar
  // upload them on cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const { fullName, username, email, password } = req.body;
  console.log("email: ", email);
  if (
    [fullName, email, username, password].some((field) => {
      field.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields is required");
  }

  const existedUser = User.findOne({ $or: [{ username }, { email }] });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.field?.avatar[0]?.path;
  const converImageLocalPath = req.files?.converImage[0];

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  const avatar =await uploadOnCloudinary(avatarLocalPath)
 const coverImage = await uploadOnCloudinary(converImageLocalPath)

 if(!avatar){
    throw new ApiError(400, "Avatar file is required")
 }

 const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username : username.toLowerCase(),
 })

 const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
 )

 if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
 }

 return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
 )
});

export { registerUser };
