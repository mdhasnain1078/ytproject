import mongoose from "mongoose";
import { Like } from "../models/like.model";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { Tweet } from "../models/tweet.model";


const toggleVideoLike = asyncHandler(async(req, res)=>{
    const {videoId} = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid videoId");
    }

    const likedAlready = await Like.findOne({
        video: videoId,
        likedBy: req?.user_id
    })

    if(likedAlready){
        await Like.findByIdAndDelete(likedAlready?._id);
        return res.status(200).json(new ApiResponse(200, {isLiked: false}));
    }

    await Like.create({
        video:videoId,
        likedBy: req.user?._id
    });

    return res.status(200).json(new ApiResponse(200, {isLiked: true}));
})


const toggleTweetLike = asyncHandler(async (req, res) =>{
    const {tweetId} = req.params;
    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweetId");
    }
        const likedAlready = await Tweet.findById(tweetId);

        if(likedAlready){
            Like.findByIdAndDelete(likedAlready?.id);

            return res.status(200).json(new ApiResponse(200, {isLiked: false}));
        }

        await Like.create({
            tweet:videoId,
            likedBy: req.user?._id
        });
    
        return res.status(200).json(new ApiResponse(200, {isLiked: true}));
});

const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideos = await Like.aggregate([
        {
            $match:{
                likedBy: mongoose.Schema.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as : "likedVideo",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField:"_id",
                            as: "ownerDetails",
                        }
                    },
                    {
                        $unwind: "$ownerDetails",
                    },
                ]
            },


        },

        {
            $unwind: "$likedVideo",
        },
        {
            $sort: {
                createdAt: -1,
            },
        },

        {
            $project: {
                _id: 0,
                likedVideo: {
                    _id: 1,
                    "videoFile.url": 1,
                    "thumbnail.url": 1,
                    owner: 1,
                    title: 1,
                    description: 1,
                    views: 1,
                    duration: 1,
                    createdAt: 1,
                    isPublished: 1,
                    ownerDetails: {
                        username: 1,
                        fullName: 1,
                        "avatar.url": 1,
                    },
                },
            },
        },
    ])

})

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };