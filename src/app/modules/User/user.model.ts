import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import config from "../../config";
import { IUserMethods, TUser, UserModel } from "./user.interface";

const userSchema = new Schema<TUser, UserModel, IUserMethods>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String },
    email: { type: String, sparse: true, unique: true },
    phone: { type: String, sparse: true, unique: true },
    password: { type: String, select: 0 },
    image: { type: String, default: "" },
    lat: { type: Number },
    long: { type: Number },
    role: {
      type: String,
      enum: ["user", "vendor", "admin", "superAdmin", "company"],
      default: "user",
    },
    authType: {
      type: String,
      enum: ["email", "employeeId", "anonymous"],
      default: "email",
    },
    employeeId: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "active",
    },
    isOtpVerified: { type: Boolean, default: false },
    otp: { type: String, select: 0 },
    otpExpires: { type: Date, select: 0 },
    acceptedTerms: { type: Boolean },
    fcmToken: { type: String, default: null },
    favoriteServices: [{ type: Schema.Types.ObjectId, ref: 'VendorService' }],
    isSponsored: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    vendor: {
      businessName: String,
      ownerName: String,
      whatsappNumber: String,
      location: {
        address: String,
        city: String,
        area: String,
        zipCode: String,
      },
      lat: Number,
      long: Number,
      businessDetails: String,
      experienceYears: Number,
      teamSize: Number,
      socialLinks: { instagram: String, facebook: String, website: String },
      googleMapLink: { type: String, default: "" },
      categories: [String],
      serviceArea: [String],
      documents: [String],
      portfolio: [String],
      bookedDates: {
        type: [String], // Array of date strings
        default: [],
      },
      availability: [
        { day: String, isOpen: Boolean, startTime: String, endTime: String },
      ],
      profileScore: { type: Number, default: 0 },
      isVerifiedBadge: { type: Boolean, default: false },
      passwordChangedAt: { type: Date },
      isProfileCompleted: { type: Boolean, default: false },
      completedTasks: { type: [String], default: [] },
    },
    lastActiveAt: { type: Date },
  },
  { timestamps: true },
);

// Pre-save hook
userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(
      this.password as string,
      Number(config.bcrypt_salt_rounds),
    );
  }
  if (this.isModified("otp") && this.otp) {
    this.otp = await bcrypt.hash(
      this.otp as string,
      Number(config.bcrypt_salt_rounds),
    );
  }
  this.fullName = `${this.firstName} ${this.lastName}`;
});

// Instance Method
userSchema.methods.isPasswordMatched = async function (plain, hashed) {
  return await bcrypt.compare(plain, hashed);
};

// Static Methods
userSchema.statics.isUserExistsById = async function (id: string) {
  return await this.findById(id).select("+password");
};

userSchema.statics.isJWTIssuedBeforePasswordChanged = function (
  passwordChangedTimestamp: Date,
  jwtIssuedTimestamp: number,
) {
  const passwordChangedTime =
    new Date(passwordChangedTimestamp).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};

export const User = model<TUser, UserModel>("User", userSchema);
