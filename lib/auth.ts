import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "starz_access_secure_jwt_secret_key_2026";
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

// --- ADMIN SESSIONS ---

/**
 * Signs a custom JWT token for the admin session
 */
export async function signAdminToken(username: string): Promise<string> {
  return await new SignJWT({ username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days session
    .sign(SECRET_KEY);
}

/**
 * Verifies the admin JWT token
 */
export async function verifyAdminToken(token: string): Promise<{ username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.role !== "admin") return null;
    return payload as { username: string };
  } catch (err) {
    return null;
  }
}

// --- B2B CLIENT SESSIONS ---

interface ClientTokenPayload {
  id: string;
  username: string;
  org_name: string;
}

/**
 * Signs a custom JWT token for a B2B Client session
 */
export async function signClientToken(payload: ClientTokenPayload): Promise<string> {
  return await new SignJWT({ ...payload, role: "client" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d") // 7 days session
    .sign(SECRET_KEY);
}

/**
 * Verifies a B2B Client JWT token
 */
export async function verifyClientToken(token: string): Promise<ClientTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    if (payload.role !== "client") return null;
    return {
      id: payload.id as string,
      username: payload.username as string,
      org_name: payload.org_name as string,
    };
  } catch (err) {
    return null;
  }
}
