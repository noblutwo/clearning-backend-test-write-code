import type { Context } from "elysia";
import { HTTP_STATUS } from "@/config/constants";
import type { AuthContext, UserRole } from "@/types/auth.types";
import type { ApiResponse } from "@/types/response.types";

function decodeAuthToken(token: string): AuthContext | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId, email, name, role] = decoded.split(":");

    if (!userId || !email || !name || !role) {
      return null;
    }

    return {
      userId,
      email,
      name,
      role: role as UserRole,
    };
  } catch (error) {
    return null;
  }
}

function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

export const requireAuth = (context: Context) => {
  const authHeader = context.request.headers.get("authorization") || undefined;
  const token = extractToken(authHeader);

  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: "Missing or invalid authorization token",
      timestamp: new Date().toISOString(),
    };

    throw new Error(
      JSON.stringify({
        status: HTTP_STATUS.UNAUTHORIZED,
        body: response,
      })
    );
  }

  const authContext = decodeAuthToken(token);
  if (!authContext) {
    const response: ApiResponse = {
      success: false,
      error: "Invalid or expired token",
      timestamp: new Date().toISOString(),
    };

    throw new Error(
      JSON.stringify({
        status: HTTP_STATUS.UNAUTHORIZED,
        body: response,
      })
    );
  }

  (context as any).authUser = authContext;
};

export const requireRole = (role: UserRole) => {
  return (context: Context) => {
    const authUser = (context as any).authUser as AuthContext | undefined;

    if (!authUser) {
      const response: ApiResponse = {
        success: false,
        error: "User context not found. Use requireAuth middleware first.",
        timestamp: new Date().toISOString(),
      };

      throw new Error(
        JSON.stringify({
          status: HTTP_STATUS.UNAUTHORIZED,
          body: response,
        })
      );
    }

    if (authUser.role !== role) {
      const response: ApiResponse = {
        success: false,
        error: `Access denied. This action requires ${role} role.`,
        timestamp: new Date().toISOString(),
      };

      throw new Error(
        JSON.stringify({
          status: HTTP_STATUS.FORBIDDEN,
          body: response,
        })
      );
    }
  };
};

export const getAuthUser = (context: Context): AuthContext => {
  const authUser = (context as any).authUser as AuthContext | undefined;
  if (!authUser) {
    throw new Error("User context not found");
  }

  return authUser;
};
