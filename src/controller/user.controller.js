import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from front end
  const { fullName, username, email, password } = req.body;
  // console.log("email: ", email);
  // console.log("fullName: ", fullName);
  // console.log("username: ", username);
  // console.log("password: ", password);

  // Validation - not empty
  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields is required");
  }

  // check if user is already exist: username email
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  // check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;

  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  // upload them on cloudinary, avatar
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  // create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token field from response

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  // return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get data from front end such as password and username
  // validation - not empty
  // check it exist or not
  // check for correct password
  // access and refresh token
  // send cookies
  // get data from db
  // reurn res

  // get data from front end such as password and username
  const { password, username, email } = req.body;

  // validation - not empty
  if (!(username || email)) {
    throw new ApiError(400, "username or email is required");
  }

  // check it exist or not
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // check for correct password

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password incorrect invalid user credentials");
  }

  // access and refresh token

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // get data from db except password and refreshToken

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
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
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request");
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "invalid refreshToken");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "refreshToken os expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user_id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fatched Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = req?.user.id;
  User.findByIdAndUpdate(
    req.user?._id,
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
    .json(new ApiResponse(200, user, "Account details update successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "While uploading on avatar");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }
  ).select("-password");
  return res.status(200).json(new ApiResponse(200, user, "Avatar image updated successfully"))
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage file is missing");
  }

  const coverImage = uploadOnCloudinary(coverImageLocalPath);
  if (!avatar.url) {
    throw new ApiError(400, "While uploading on coverImage");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImageLocalPath.url,
      },
    },
    { new: true }
  ).select("-password");

  return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully"))
});


const getUserChennelProfile = asyncHandler(async (req, res)=>{
  const {username} = req.params;

  if (!username?.trim()) {
    throw new ApiError(401, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase()
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        localField:"_id",
        foreignField: "channel",
        as: "subscribers"
      },
    },
    {
      $lookup:{
        from:"subscriptions",
        localField:"-id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    {
      $addFields:{
        subscribersCount:{
          $size:"$subscribers"
        },
        chennelsSubscribedToCount:{
          $size:"$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscriber"]
            },
            then: true,
            else: false,
          }
        }
      }
    },
    {
      $project:{
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        chennelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,

      }
    }
  ])
  if (!channel?.length()) {
    throw new ApiError(404, "chennel does not exists")
  }

  return res.status(200).json(new ApiResponse(200, channel[0], "User chennel fetched successfully"))

})


const getWatchedHistory = asyncHandler(async(req, res)=>{
  const user = await User.aggregate([
    {
      $match: new mongoose.Types.ObjectId(req.user._id)
    },
    {
      $lookup: {
        from: "videos",
        localField:"watchHistory",
        foreignField:"_id",
        as: "watchHistory",
        pipeline:[
          {
            $lookup:{
              from: "users",
              localField: "owner",
              foreignField:"_id",
              as: "owner",
              pipeline:[
                {
                  $project:{
                    fullName:1,
                    username: 1,
                    avatar:1
                  }
                }
                ,
                  {
                    $addFields:{
                      owner:{
                        $first:"$owner"
                      }
                    }
                  }
              ]
            }
          }
        ]
      }
    }
  ])

  return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "WatchHiatory fetched successfully"))
})
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChennelProfile
};
