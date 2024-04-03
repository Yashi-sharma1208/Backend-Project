import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
const registerUser = asyncHandler (async (req,res)=>{
    // Alogorithm for registration Process
    // 1). Take Input from frontend
    // 2). Apply validations
    // 3). Check whether user already exists or not
    // 4). If everything is fine then proceed for images-- upload images on local path
    // 5). Upload Images on cloudinary -- check for avatar
    // 6). Get the url of images from cloudinary-- check for avatar
    // 7). insert data into database
    // 8). Remove password and refresh token from database response
    // 9). Return response

    // Taken input from frontend
    const {email,username,password,fullName} = req.body
    // Making sure that all required fields are not empty
    if(
        [email,username,password,fullName].some((field)=> field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }
    // Check whether user already exists or not
    const isUserExist = await User.findOne({
        $or:[{username},{email}]
    })
    if(isUserExist){
        throw new ApiError(409,"User already exists")
    }
    // Uploading files on cloudinary
    console.log("Files = ",req.files)
    let avatarLocalPath;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length>0){
        avatarLocalPath = req.files.avatar[0].path
    }
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    // If avatar doesn't exist then return an error
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400,"Failed to upload avatar on cloudinary")
    }
    const user = await User.create({
        username: username.toLowerCase(),
        password,
        email,
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if(!createdUser){
        throw new ApiError(500,"Failed to insert data into database")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User has been registered successfully")
    )
})

const loginUser = asyncHandler(async (req,res)=>{
    // Steps to login
    // 1). Take (email or username) and password from frontend
    // 2). check these fields should not be empty
    // 3). check whether user is registered or not
    // 4). If user is already registered then check whether the entries are matched or not
    // 5). Generate accesstoken and refreshtoken
    // 6). send response

    // Taking input from body
    const {username,email,password} = req.body
    // if(!username && !email && !password){
    //     throw new ApiError(400,"All fileds are required")
    // }
    if(!email && !username){
        throw new ApiError(400,"Email or Username is required")
    }
    if(!password){
        throw new ApiError(400,"Password is required")
    }
    // Cheking if the user is already registered
    const user = await User.findOne({
        $or: [{email},{username}]
    })

    // If user is not registered then throw the error
    if(!user){
        throw new ApiError(404,"User is not registered")
    }

    //Checking password
    const isPasswordValid =  user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Incorrect Password")
    }

    // Generate access and refresh token
    const {accessToken,refreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    // const loggedInUser = user.select("-password -refreshToken")
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // defining options for cookies
    const options = {
        // Cookies cannot be modified from client site by setting these properties to be true 
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User LoggedIn successfully"
        )
    )
})

const generateAccessTokenAndRefreshToken = async (userId) => {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()
    // Saving the value of refresh token into database for user object
    user.refreshToken = refreshToken
    // Saving value without any validation
    user.save({validateBeforeSave : false})
    // returning values of accesstoken and refreshtoken as an object
    return {accessToken,refreshToken}
}

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndDelete(
        req.user._id,
        {
            $set : {refreshToken: undefined}
        },
        {
            new: true
        }
        )
        const options = {
            // Cookies cannot be modified from client site by setting these properties to be true 
            httpOnly: true,
            secure: true
        }
        res.status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User Logged Out Successfully"))
})
const refreshAccessToken = asyncHandler(async (req,res) =>{
    const  incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decodedToken._id)
    if(!user){
        throw new ApiError(401,"Invalid refresh token")
    }

    if(incomingRefreshToken !== user.refreshToken){
        throw new ApiError(401,"Refresh token is expired or used")
    }
    const {accessToken,newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    const options = {
        httpOnly : true,
        secure : true
    }
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json(
        new ApiResponse(200,{accessToken,refreshToken : newRefreshToken},"Access token has been refreshed")
    )
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {newPassword,oldPassword,confirmPassword} = req.body
    if(newPassword!==confirmPassword){
        throw new ApiError(400,"New password and confirm password must be same")
    }
    const user = User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,"Password has been changed"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"Current user fetched successfully")
})
const updateAccountDetails = asyncHandler(async(req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
        
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
});
const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"failed to update avatar file on cloudinary")
    }
    const user =await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            },
        },
        {new:true}
    ).select("-password")
    res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))
})
const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"failed to update cover image file on cloudinary")
    }
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            },
        },
        {new:true}
    ).select("-password")
    res
    .status(200)
    .json(new ApiResponse(200,user,"Cover image updated successfully"))
})
const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params
    if(!username?.trim()){
        throw new ApiError(404,"Username not found")
    }
    const channel = await User.aggregate([
        {
            $match:{
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField:"channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if: {$in: [req.user?._id,"$subscribers.subscriber"]},
                        then: true,
                        else : false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                username: 1,
                email: 1,
                subscribersCount: 1,
                channelsSubscribedToCount,
                isSubscribed,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])
    if(!channel?.length){
        throw new ApiError(404,"Channel not found")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"User Channel fetched successfully")
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateUserAvatar,
    updateUserCoverImage,
    updateAccountDetails,
    getUserChannelProfile
}