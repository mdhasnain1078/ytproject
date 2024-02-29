import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.models.js"
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // TODO: toggle subscription
    if(!isValidObjectId(channelId)){
        ApiError(400, "Invalid channelId");
    }

    const isSubscribe = await Subscription.findOne({
        subscriber: req.user?._id,
        channel: channelId
    })

    if(isSubscribe){
        await Subscription.findByIdAndDelete(isSubscribe?._id)

        return res.status(200).json(new ApiResponse(
            200,
            { subscribed: false },
            "unsunscribed successfully"
        ))
    }

    await Subscription.create({
        subscriber: req.user?._id,
        channel: channelId
    });

    return res.status(200).json(new ApiResponse(200, {subscribed: true}, "subscribed successfully"))
    
})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    // check channelId is valid
    if(!isValidObjectId(channelId)){
        new ApiError(400, "Invalid channelId")
    }

    channelId = new mongoose.Schema.Types.ObjectId(channelId)

    // get subscribers using aggregation

    await Subscription.aggregate([
        {
            $match: {
                _id: channelId
            }
        },
        {
            $lookup: {
                from: "users",
                localField:"subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline:[
                    {
                        $lookup:{
                            from: "subscriptions",
                            localField: "_id",
                            foreignField: "channel",
                            as: "subscribedToSubscriber"
                        }
                    }
                ]
              },
        },
        {
            $addFields:{
                subscribedToSubscriber:{
                    $cond:{
                        if:{
                            $in:[
                                channelId, "$subscribedToSubscriber.subscriber"
                            ],

                        },
                        then: true,
                        else: false,
                    }
                },
                subscribersCount: {
                    $size: "$subscribedToSubscriber",
                },
            }
        },
        {
            $unwind: "$subscriber"
        },
        {
            $project: {
                _id: 0,
                subscriber: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    subscribedToSubscriber: 1,
                    subscribersCount: 1,
                },
            },
        },
    ])


    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribers,
                "subscribers fetched successfully"
            )
        );
})

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params
    if(!isValidObjectId(subscriberId)){
        new ApiError(400, "invalid subscriberId");
    }

    subscriberId = new mongoose.Schema.Types.ObjectId(subscriberId);

    await Subscription.aggregate([
        {
            $match: {
                subscriber : subscriberId
            },
        },
        {
            $lookup: {
                from: "users",
                localField:"chennel",
                foreignField: "_id",
                as: "subscribedChannel",
                pipeline: [
                    {
                        $lookup: {
                            from: "videos",
                            localField: "_id",
                            foreignField: "owner",
                            as: "videos",
                        },
                    },
                    {
                        $addFields: {
                            latestVideo: {
                                $last: "$videos",
                            },
                        },
                    },

                ],
            }
        },

        {
            $unwind: "$subscribedChannel",
        },
        {
            $project: {
                _id: 0,
                subscribedChannel: {
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                    latestVideo: {
                        _id: 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        createdAt: 1,
                        views: 1
                    },
                },
            },
        },
    ])
})

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}
