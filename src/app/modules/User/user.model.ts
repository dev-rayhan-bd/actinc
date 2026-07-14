import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import config from "../../config";
import { IUserMethods, TUser, UserModel } from "./user.interface";

const userSchema = new Schema<TUser, UserModel, IUserMethods>(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String },
    image: { type: String, default: "" },
    email: { type: String, sparse: true, unique: true },
    phone: { type: String, sparse: true, unique: true },
    password: { type: String, select: 0 },
    authType: {
      type: String,
      enum: ["email", "employeeId", "anonymous"],
      default: "email",
    },
    role: {
      type: String,
      enum: ["user", "admin", "superAdmin", "company"],
      default: "user",
    },
    employeeId: { type: String },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active",
    },
    isOtpVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    otp: { type: String, select: 0 },
    otpExpires: { type: Date, select: 0 },
    acceptedTerms: { type: Boolean },
    fcmToken: { type: String, default: null },
    passwordChangedAt: { type: Date },
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
