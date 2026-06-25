# Starz Access Control System - Walkthrough

A professional, secure, and industrial-grade web application built in the `/starz/starz` directory. It streamlines facility access, eliminates gate delays, and automates multi-channel notifications between visitors, administrators (owners), and security gate guards.

---

## 🏗️ Codebase Anatomy & Implementation Details

The system is fully constructed at the root level of your Next.js project using the **App Router (no `src` folder)**, **Tailwind CSS**, and **Supabase (as a database)**. Below is a breakdown of the core files implemented:

### 1. Style & Theme Configuration
* **[globals.css](file:///c:/Users/hp/Desktop/starz/starz/app/globals.css):** Tailored with your exact corporate color palette: Deep Corporate Blues (`#001d3f`, `#04356A`) and Dull White (`#f8f9fa`). Enforces a **strict maximum border-radius cap of 4px** (`rounded` or `rounded-sm`) on all utility classes. Zero glassmorphism, flat professional layouts, and custom slate scrollbars.

### 2. Client-Side Interactive Interfaces
* **[VisitorForm.tsx](file:///c:/Users/hp/Desktop/starz/starz/components/VisitorForm.tsx):** A high-contrast, single-page registration form. Features:
  - Strict input validation.
  - A custom-styled modern **Date Picker**.
  - A **badge-based machinery listing UI** (typing a machine name and pressing enter/clicking adds it as a sharp, flat tag with a delete button).
  - Success states showcasing their secure Ticket ID.
  - Exclusively uses `lucide-react` for premium iconography (no emojis in the UI).
* **[AdminDashboard.tsx](file:///c:/Users/hp/Desktop/starz/starz/components/AdminDashboard.tsx):** A complete administration control panel featuring:
  - Real-time visitor logs table (dynamically synced via Supabase Realtime).
  - Stat counters (Pending, Approved, Denied).
  - Interactive Action Modal/Drawer allowing one-click **Approvals** and **Denials** (with mandatory text inputs for denial reasons).
  - Active form link copier and clipboard manager.
  - A prominent crimson **"Terminate & Rotate Link"** button to immediately invalidate leaked or expired tokens.
  - Security guard WhatsApp numbers management table.
  - Owner alert settings dashboard.

### 3. Server-Side Page Controllers
* **[page.tsx (Home)](file:///c:/Users/hp/Desktop/starz/starz/app/page.tsx):** Automatically redirects root domain traffic (`/`) to the admin login portal.
* **[request-access/page.tsx](file:///c:/Users/hp/Desktop/starz/starz/app/request-access/page.tsx):** Validates the URL token against Supabase. If valid, renders the `VisitorForm` client component. If invalid or terminated, transitions into a high-contrast corporate **"Expired Link"** error page.
* **[dashboard/page.tsx](file:///c:/Users/hp/Desktop/starz/starz/app/dashboard/page.tsx):** Restrictive administrative page that fetches initial requests, active tokens, settings, and guards database. It features **self-healing auto-generation**—if no active token or owner settings exist in the database, it automatically generates and inserts the initial configs on load.
* **[verify/[ticket_number]/page.tsx](file:///c:/Users/hp/Desktop/starz/starz/app/verify/%5Bticket_number%5D/page.tsx):** A high-contrast, mobile-optimized public portal. Instantly checks the database for the scanned ticket and displays a bold green **"APPROVED"** banner, red **"DENIED"** banner, or error notice, along with expected machinery lists for gate guards to verify.

### 4. Custom JWT Authentication & Middleware
* **[auth.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/auth.ts):** Lightweight, Edge-compatible JWT utility using the `jose` library to sign and verify administrative sessions.
* **[middleware.ts](file:///c:/Users/hp/Desktop/starz/starz/middleware.ts):** Placed at the root. Intercepts and guards `/dashboard` pages and `/api/admin/*` endpoints. Validates the `admin_session` cookie; redirects unauthorized page traffic to `/login` and blocks unauthorized API calls with a clean 401 JSON error.
* **[login/page.tsx](file:///c:/Users/hp/Desktop/starz/starz/app/login/page.tsx):** A highly secure, corporate-styled login form that validates credentials against environment variables and stores sessions in secure, HTTP-Only cookies.

### 5. API Endpoints
* **[api/auth/login](file:///c:/Users/hp/Desktop/starz/starz/app/api/auth/login/route.ts) & [api/auth/logout](file:///c:/Users/hp/Desktop/starz/starz/app/api/auth/logout/route.ts):** Handles cookie session signing and deletion.
* **[api/requests/submit](file:///c:/Users/hp/Desktop/starz/starz/app/api/requests/submit/route.ts):** Public submission endpoint. Checks form token validity, generates a secure unguessable ticket, inserts the request, and triggers a WhatsApp alert to the owner.
* **[api/admin/requests/decide](file:///c:/Users/hp/Desktop/starz/starz/app/api/admin/requests/decide/route.ts):** Secure endpoint. Updates database status and dispatches multi-channel alerts:
  - Approved: Email (HTML + QR Code) and WhatsApp to visitor; WhatsApp containing complete visitor/machinery details to all active security numbers.
  - Denied: Email and WhatsApp showing the denial reason to the visitor.
* **[api/admin/tokens/regenerate](file:///c:/Users/hp/Desktop/starz/starz/app/api/admin/tokens/regenerate/route.ts):** Revokes current active token and inserts a new one.
* **[api/admin/security-contacts](file:///c:/Users/hp/Desktop/starz/starz/app/api/admin/security-contacts/route.ts) & [api/admin/settings](file:///c:/Users/hp/Desktop/starz/starz/app/api/admin/settings/route.ts):** Handles guard database additions/removals and settings configuration.

### 6. Notification Dispatchers & Templates
* **[twilio.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/twilio.ts) & [resend.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/resend.ts):** Engineered using lightweight, built-in REST `fetch` integrations rather than heavy external SDKs. This ensures **100% Edge-compatibility** and zero dependency overhead.
* **[emailTemplates.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/emailTemplates.ts):** Generates high-fidelity, responsive HTML emails with navy branding, clean tables, and a **dynamic QR code image** generated via a free public QR Server API.
* **[ticket.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/ticket.ts):** Combines custom alphabets with `nanoid` to generate cryptographically secure ticket numbers in your exact requested format: `STYD.MQRGNTLB-910B2539`.
* **[supabase.ts](file:///c:/Users/hp/Desktop/starz/starz/lib/supabase.ts):** Initializes standard public clients (for RLS operations) and an admin service client (to bypass RLS in secure API endpoints).

---

## 🛠️ Step-by-Step Setup Instructions

Follow these steps to configure your environment and run the application locally:

### Step 1: Execute Database Setup in Supabase
Open your **Supabase Dashboard**, navigate to the **SQL Editor**, create a new query, copy the entire contents of [schema.sql](file:///c:/Users/hp/Desktop/starz/starz/schema.sql) into it, and click **Run**.
This script will automatically:
1. Create tables: `form_tokens`, `access_requests`, `security_contacts`, and `admin_settings`.
2. Set up Postgres triggers that automatically write `updated_at` timestamps on row updates.
3. Enable Row-Level Security (RLS) and enforce select/insert policies on public tables, while keeping administrative tables fully private.

### Step 2: Configure Environment Variables
1. Copy [env.local.example](file:///c:/Users/hp/Desktop/starz/starz/.env.local.example) to a new file named `.env.local` in the `/starz/starz` directory.
2. Fill in the values:
   - **Supabase Keys:** URL, Anon Key, and Service Role Key (from Supabase Settings -> API).
   - **Admin Credentials:** Set your desired username, password, and a random `JWT_SECRET` string.
   - **Twilio Keys:** Account SID, Auth Token, and WhatsApp From Number (sandbox uses `+14155238886`).
   - **Resend Keys:** API Key (e.g., `re_...`) and your sender address (default `Starz Access <onboarding@resend.dev>` for testing).

### Step 3: Run the Application
In your terminal, navigate to the `/starz/starz` directory and run:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. It will automatically redirect to the `/login` portal.

---

## 🧪 Manual Verification Checklist

Once the database and environment are configured, perform these manual tests to verify the system's absolute correctness:

1. **Gate Guard Redirection (Auth Middleware):**
   - Attempt to access `http://localhost:3000/dashboard` in a private browsing window.
   - *Verification:* The system must immediately intercept the request and redirect you to `http://localhost:3000/login`.

2. **Admin Authentication & JWT Cookie:**
   - Log in at `/login` using the credentials defined in your `.env.local` file.
   - *Verification:* You must be successfully redirected to the dashboard, and a secure HTTP-Only cookie named `admin_session` must be visible in your browser's dev tools.

3. **Link Rotation & Expiration:**
   - Navigate to the dashboard. Under the link manager, click **Copy Link**. Open it in another browser. The visitor form should load.
   - Go back to the dashboard, click the crimson **Terminate & Rotate Link** button.
   - Reload the visitor form page you opened earlier.
   - *Verification:* The form must instantly transition to the corporate **"Access Link Expired"** page, showing that the old token was successfully deactivated.

4. **Real-time Dashboard Submissions:**
   - Arrange your screen to show the admin dashboard on one half, and the new active visitor form link on the other.
   - Submit a visitor registration (include visitor details, date, and multiple machineries).
   - *Verification:* Upon clicking submit, the new request must instantly slide into the admin dashboard table without requiring a page refresh. The owner should also receive a WhatsApp alert containing the visitor details.

5. **Decision Notifications (E2E Delivery):**
   - On the dashboard, click **Review** next to the new pending request.
   - Click **Approve**.
   - *Verification:*
     - The visitor must receive a WhatsApp message and a beautifully formatted HTML email containing the large monospaced Ticket ID (e.g. `STYD.MQRGNTLB-910B2539`) and expected date.
     - All active phone numbers in the **Security Guard Contacts** list must receive a detailed WhatsApp containing the complete details of the visitor, expected date, and the machinery checklist.
     - Repeat the test with a **Deny** decision, and verify that the visitor receives a WhatsApp and email stating they were declined, including the exact denial reason you entered.

6. **QR Code gate scanning:**
   - Open the approved ticket email. 
   - Scan the embedded QR code using a mobile phone camera.
   - *Verification:* It must open `http://localhost:3000/verify/STYD...` in your mobile browser, displaying a large green **"VERIFIED ACCESS APPROVED"** banner, visitor credentials, and the expected machinery checklist.

---

## 🚀 Phase 2: Advanced Security & UX Enhancements

This update integrates strict security auditing protocols, smart B2B notification routing, custom admin signature injection, and premium UX controls across the STARZS system.

### 📦 Extended Database Schema (Migration SQL)
Run the following script in your **Supabase SQL Editor** to enable the auditing and registry tables:

```sql
-- 1. Create Security Guards Table
CREATE TABLE public.security_guards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    phone text NOT NULL,
    code text NOT NULL UNIQUE,
    status text DEFAULT 'active'::text NOT NULL CHECK (status in ('active', 'inactive')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Alter Access Requests Table for Staff Tracing & Guard Auditing
ALTER TABLE public.access_requests 
  ADD COLUMN requesting_staff_name text DEFAULT '' NOT NULL,
  ADD COLUMN requesting_staff_email text,
  ADD COLUMN entered_by text,
  ADD COLUMN exited_by text;
```

### 💎 Key Enhancements & Operational Flow

#### 1. Security Guard Gate Auditing PIN
* **Roster Management (Admin)**: Administrators manage security guards via a new CRUD panel in the settings drawer. Each officer is assigned a unique, active authorization code.
* **Strict Gate Verification**: In the Verification Portal (`/verify/[ticket_number]`), checking a visitor IN or OUT now strictly requires entering a valid, active security guard authorization code.
* **Audit Trail**: Check-in and check-out API routes validate the code and record the authorizing officer's name in the `entered_by` and `exited_by` database columns. Drawer details on both the Admin and Client dashboards dynamically display these auditing stamps.

#### 2. B2B Staff Tracing & Smart Notification Routing
* **Staff Fields**: B2B Clients now register compound entries by specifying the **Requesting Staff Name** (required) and **Requesting Staff Email** (optional).
* **Smart Routing**: Approval/denial emails are sent directly to the requesting staff's email if provided. If not, they default to the B2B client's primary workspace login email.
* **CC Redundancy Removal**: Unused CC emails settings are completely removed, keeping the client settings interface extremely clean.

#### 3. Outgoing Email Brand & Custom Signatures
* **Branded Mail Header**: All email notifications display the corporate header: **Starzs Marine and Engineering Ltd (SMEL) Access Control**.
* **Admin Signature Customizer**: Administrators configure their Name, Phone, and Designation/Company in the settings panel. These details are dynamically appended as a professional sign-off block at the bottom of all approved, denied, or rescheduled email dispatches.

#### 4. Premium Admin UX Configurations
* **B2B Client Filter**: A dynamic client partner dropdown is placed next to the status filter in the logs header, allowing one-click log isolation for any B2B partner.
* **Table Pagination**: Both Admin and B2B Client logs tables slice results into pages of 10 items, complete with sleek bottom pagination footer controls to optimize page loading speed.
* **Interactive Pill-Based Email Tag Builder**: The comma-separated administrator email input is replaced with a premium, pill-based email tag builder. Admins type an email and hit Enter or click "Add" to render it as a stylish tag pill with a click-to-remove "×" button.
* **Dynamic Resource Category Creator**: Administrators add or remove custom resource checklist categories (e.g. "Vehicles", "Tools", "Provisions") directly from settings. These categories instantly propagate to all B2B client entry forms.

