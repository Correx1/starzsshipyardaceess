# B2B Client Portal Facility Access System (Starz Access) - Implementation Plan

A professional, enterprise-grade B2B access management system designed to streamline facility entry, eliminate gate delays, and automate email ticket dispatches between clients, facility administrators (owners), and security gate personnel.

---

## 🌟 The B2B Workflow & Core Features

We are implementing a secure, closed-loop **B2B Client Portal** system with advanced security auditing:

1. **Client Account & Status Management (Admin Dashboard)**:
   - The Owner (Admin) logs in to their dashboard and can create, view, and manage **Client Accounts** representing partner organizations (e.g., "Clautechs Industries").
   - For each client, the Admin generates a unique Organization Name and secure **Client Login Credentials** (username/email and password).
   - **Hashed Password Storage**: Client passwords are encrypted using secure one-way cryptographic hashing (SHA-256 with salt) before saving to the database.
   - **Granular Account Control**: The Admin can manage and restrict client accounts using statuses:
     - `active`: Full portal access (login, view history, submit new requests).
     - `suspended`: Login is completely blocked. Existing sessions are instantly invalidated by Middleware.
     - `restricted`: Login is allowed, but the client is blocked from submitting new requests (can only view past history).

2. **Owner-Configured Request Settings (Dynamic Customization)**:
   - The Admin can manage what resource categories are allowed in the entry requests from their settings panel.
   - Dynamic configurations (e.g., enabling/disabling Categories like "Machinery", "Staff/Labor", "Materials/Cargo", or custom items) are stored as JSON in `admin_settings`.
   - The client's request form dynamically adapts to these allowed categories on load.

3. **Vast & Robust Resource Request Builder (Client Dashboard)**:
   - Instead of a simple machinery text list, the system features a **vast, structured resource builder**.
   - Clients log in securely via **local JWT auth** (stored in a secure, HTTP-Only `client_session` cookie).
   - In the submission form (pre-filled with their locked Org Name), clients can dynamically build a list of diverse resources they are bringing in:
     - **Staff / Labor**: Quantity, Department/Department Role, Supervisor.
     - **Machinery / Equipment**: Quantity, Type/Model, Serial Number (optional).
     - **Materials / Cargo**: Quantity, Type, Description.
     - **Other / Vehicles**: Custom categories enabled by the Admin.
   - The client selects a category from a dropdown, enters the specific details, and clicks "+ Add to Request". The items are rendered in a flat, modern, structured list showing category badges and details.
   - The client can also add **up to 2 additional email addresses** to receive ticket updates.

4. **One-Time Use Tickets, Gate Auditing, & Offline PIN Fallback**:
   - **One-Time Expiration Logic**: A ticket is strictly valid for **one complete entry and exit cycle**. Once both check-in and check-out are logged, the ticket is permanently invalidated:
     - *Check-In Pending* (No timestamps): Ticket is **Active & Valid** for entry.
     - *Checked In* (`entered_at` set, `exited_at` null): The visitor is **Currently Inside**. Valid only for exit logging.
     - *Checked Out* (Both timestamps set): The ticket is **Expired & Used**. Any subsequent scan shows a bold red warning: *"TICKET EXPIRED & ALREADY USED"*.
   - **Gate Auditing**: When security scans the QR code, the verification portal displays **"Log Check-In"** or **"Log Check-Out"** buttons. Tapping these writes the exact UTC timestamps (`entered_at` and `exited_at`) directly to the database.
   - **Offline PIN Fallback**: For every request, the system generates a unique **6-digit Numeric PIN** (e.g., `921083`) alongside the long Ticket ID. If the driver's phone is dead or offline, the guard can simply type this 6-digit PIN into the verification portal to retrieve and log their entry.
   - **Print-Ready Ticket Layout**: Approved emails contain a link to a print-optimized route (`/ticket/[ticket_number]`). It uses CSS `@media print` rules to render a clean, high-contrast physical paper pass.

5. **Symmetrical Rich Request Details Drawer (Admin & Client Dashboards)**:
   - Both the **Admin Dashboard** and **Client Portal Dashboard** feature an identical, rich **Review Drawer** to view request details:
     - **Visitor Profile**: Full name, email, phone, and expected date.
     - **Structured Resource Checklist**: The complete list of registered staff, machinery models, and cargo.
     - **Real-Time Gate Logs**: Displays the exact **Check-In** and **Check-Out** timestamps recorded by the guard.
     - **Active Ticket QR Code**: Displays the scannable QR code directly inside the drawer for easy download or sharing.
     - **Robust Status Indicator**: A color-coded status badge showing the complete lifecycle:
       - `Pending Approval` (Amber)
       - `Access Approved / Ready for Entry` (Emerald)
       - `Inside Compound` (Blue - checked-in, but not checked-out)
       - `Ticket Expired / Used` (Gray - checked-out)
       - `Request Denied` (Crimson - showing denial reason)

6. **Notification Engine (100% Email via Resend)**:
   - **On Submission**: The system automatically dispatches a clean HTML email alert to the Owner's configured notification emails.
   - **On Decision (Approve/Deny)**:
     - If the Admin **approves** the request: A premium HTML ticket email containing a **dynamic QR code**, the secure Ticket ID (`STYD.MQRGNTLB-910B2539` generated via `nanoid`), the 6-digit PIN, and the structured resource checklist is dispatched to the driver, the client, and the client's CC emails.
     - If the Admin **denies** the request: A professional email containing the exact denial reason is dispatched to the same recipients.
   - **Zero Running Costs**: Runs entirely on the free tiers of Resend and Supabase ($0.00/month!).

---

## 🛠️ Tech Stack & Directory Structure

- **Framework**: Next.js (App Router, located at the root, no `src` folder)
- **Styling**: Tailwind CSS (max 4px border-radius, no glassmorphism, modern corporate theme)
- **Database**: Supabase (Relational client with triggers, RLS, and Realtime subscriptions)
- **Authentication**: Dual-Role Custom JWT Auth:
  - Admin: `admin_session` cookie, guarding `/dashboard` and `/api/admin/*`
  - Client: `client_session` cookie, guarding `/client/dashboard` and `/api/client/*`
- **Iconography**: React Icons (`lucide-react`) exclusively (no emojis in the UI)
- **Notification API**: Resend (Email API)
- **Token Generation**: `nanoid` (for secure Ticket IDs) and `jose` (for JWTs)
- **Encryption**: Web Crypto API / Node `crypto` (for secure SHA-256 client password hashing)

---

## 🗄️ Database Schema (Supabase)

All tables feature both `created_at` and `updated_at` timestamps managed by automated Postgres triggers.

### 1. `clients`
Stores B2B client details, hashed passwords, and statuses.
```sql
create table public.clients (
    id uuid default gen_random_uuid() primary key,
    org_name text not null unique,
    username text not null unique, -- Email or handle used to log in
    password text not null, -- Cryptographically hashed password (SHA-256 + salt)
    salt text not null, -- Cryptographic salt used for hashing
    status text default 'active'::text not null check (status in ('active', 'suspended', 'restricted')),
    notification_emails jsonb default '[]'::jsonb not null, -- Array: ["email1@co.com", "email2@co.com"]
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 2. `access_requests`
Stores requests, resource payloads, gate logging timestamps, and the 6-digit backup PIN.
```sql
create table public.access_requests (
    id uuid default gen_random_uuid() primary key,
    ticket_number text not null unique, -- E.g., STYD.MQRGNTLB-910B2539
    pin_code text not null unique, -- 6-digit numeric backup code (e.g. 921083)
    client_id uuid not null references public.clients(id) on delete cascade,
    visitor_name text not null, -- Driver's name
    visitor_email text not null,
    visitor_phone text not null,
    resources jsonb not null, -- Array of resource objects
    expected_date date not null,
    status text default 'pending'::text not null check (status in ('pending', 'approved', 'denied')),
    denial_reason text,
    entered_at timestamp with time zone, -- Check-In timestamp
    exited_at timestamp with time zone, -- Check-Out timestamp
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 3. `admin_settings`
Stores system configuration including admin notification alert destinations and allowed resource categories.
```sql
create table public.admin_settings (
    key text primary key,
    value text not null, -- E.g. key: 'allowed_resource_categories', value: '["machinery", "staff", "materials", "other"]'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

---

## 🔒 Dual-Role JWT Authentication Flow

To secure both portal roles, we will configure Next.js Edge Middleware to enforce strict routing separation:

### Cookie Configurations:
- **Admin**: Cookie `admin_session`, contains `{ username: "admin" }`
- **Client**: Cookie `client_session`, contains `{ id: "client-uuid", username: "client-username", org_name: "client-org", status: "client-status" }`

---

## 🎨 UI/UX Design System (Corporate & Utility-First)

The design constraints are strictly maintained: Tailwind CSS v4, maximum 4px border-radius, solid high-contrast cards (no glassmorphism), deep corporate blue accents, and React Icons exclusively.

### Screen Map:
1. **Admin Portal (`/dashboard`)**:
   - **Metrics Panel**: High-contrast widgets for active requests.
   - **B2B Clients Manager Card**: A dedicated panel to add new clients, view client profiles, and manage their status via a dropdown (**Active**, **Suspended**, **Restricted**). Automatically hashes client passwords.
   - **Requests Board**: Real-time table showing all incoming requests from all clients. Clicking a request opens the Review Drawer.
   - **Review Drawer**: Symmetrical, rich drawer containing visitor profile, resource checklist, real-time gate check-in/out timestamps, QR code view, and one-click Approve/Deny buttons.
   - **Settings Panel**: Configure admin notification emails and manage allowed request categories.
2. **Client Portal Login (`/client/login`)**:
   - Centered, premium split-screen layout (corporate visual left, login card right) matching the admin login aesthetics.
3. **Client Portal Dashboard (`/client/dashboard`)**:
   - **Left Panel (Vast Request Form)**: Clean single-page form with pre-filled, read-only Organization Name.
     - **Status Banner**: If the account status is `restricted`, disables submissions.
     - **Dynamic Item Builder**: Dropdown to select category (Staff, Machinery, Materials). Adapts input fields based on category selection (e.g., showing "Department" for Staff, "Model" for Machinery). A "+ Add Item" button builds a list in state.
     - Inputs for Driver details and expected date with a styled calendar picker.
   - **Right Panel (Request Logs)**: A flat table showing only this client's submitted requests, their real-time status, gate logs (timestamps), and their corresponding Ticket Numbers/PINs. Clicking a request opens the Client Review Drawer.
   - **Client Review Drawer**: Symmetrical, rich drawer containing visitor profile, resource checklist, real-time gate check-in/out timestamps, and the active QR code.
   - **Header Settings**: Option to add/edit up to 2 additional notification email addresses.
4. **Security Verification Portal (`/verify/[ticket_number]` or `/verify`)**:
   - **Search Home (`/verify`)**: A clean page for guards to enter the **6-digit Numeric PIN** if the driver is offline.
   - **Ticket View (`/verify/[ticket_number]`)**:
     - Shows bold green **"APPROVED"** banner, amber **"PENDING"** banner, or red **"DENIED"** banner.
     - If both timestamps are set, displays a giant red **"EXPIRED TICKET & ALREADY USED"** warning banner.
     - Displays visitor details and the structured resource checklist.
     - If ticket is approved and valid: Displays a green **"Log Check-In"** button (if `entered_at` is null). Displays a red **"Log Check-Out"** button (if `entered_at` is set and `exited_at` is null). Tapping these makes an API call to log timestamps.
5. **Print Gate Pass Page (`/ticket/[ticket_number]`)**:
   - A public, print-friendly, minimalist white page designed for paper printouts. Showcases the QR code, the 6-digit PIN, driver details, and the resource checklist. Automatically opens the browser print dialog on load.

---

## 🛠️ Revised Step-by-Step Implementation Plan

### Phase 1: Database Migration & Environment Reconfig
1. Draft and execute the new B2B database migration (`clients`, `access_requests`, `admin_settings`), including `pin_code` and check-in/out timestamps.
2. Create the password hashing utility `/lib/crypto.ts` using Node's built-in `crypto` module (SHA-256 with random salt generation).
3. Update `.env.local` to ensure Supabase and Resend keys are ready.

### Phase 2: Dual-Role Authentication & Middleware
1. Update `middleware.ts` to implement the dual-role routing guard (protecting `/dashboard` for admins and `/client/dashboard` for clients), and enforce cookie deletion on `suspended` client accounts.
2. Update `/lib/auth.ts` to support signing client session JWTs.
3. Implement `/api/auth/client-login` and `/api/auth/client-logout` API endpoints.
4. Build the Client Login page `/client/login`.

### Phase 3: B2B Client Portal & Vast Resource Request Form
1. Build the client dashboard view `/client/dashboard`.
2. Implement the single-page request form featuring the **Dynamic Item Builder** (adapts fields based on category selection: Staff, Machinery, Materials, and builds a list of requested resources in state).
3. Connect submission to `/api/client/requests/submit` to generate a 6-digit PIN, save to the database, and alert the admin.
4. Build the client request history table with real-time Supabase subscriptions. Clicking a row opens the Client Review Drawer.
5. Implement the client additional notification settings panel.

### Phase 4: Admin Dashboard B2B Extensions & Settings
1. Update the Admin Dashboard `/dashboard` to include the **B2B Clients Manager** (an inline form to create new clients, a table of active client accounts, and a dropdown next to each to toggle statuses: Active, Suspended, Restricted connected to `/api/admin/clients`). It will hash passwords before database insertion.
2. Update the requests table to display which Client Organization submitted each request. Clicking a row opens the Admin Review Drawer.
3. Update the Admin settings panel to manage admin notification alert emails and enable/disable allowed request categories (Staff, Machinery, Materials).
4. Update the Review Drawer to render the detailed, structured resource checklist, check-in/out timestamps, and the active QR code.

### Phase 5: Resend Email Notification Engine
1. Update `/api/client/requests/submit` to generate secure tickets, save requests, and dispatch a new submission email to the Admin.
2. Update `/api/admin/requests/decide` to process decisions and dispatch multi-recipient HTML tickets (with QR codes, 6-digit PINs, and print links for approvals) to the driver, client, and client cc emails.
3. Create the print-optimized ticket page `/ticket/[ticket_number]`.

### Phase 6: Security Verification & Gate Logging API
1. Build the gate logging API routes `/api/admin/requests/check-in` and `/api/admin/requests/check-out` to write timestamps.
2. Build the Security Verification Portal search page `/verify` (to look up by 6-digit PIN) and the ticket page `/verify/[ticket_number]` (to display details, check validity, and render "Log Check-In"/"Log Check-Out" buttons).
3. Verify that once check-in and check-out are logged, the ticket displays as expired.

### Phase 7: E2E Verification & Polish
1. Verify dual-role JWT cookie-based middleware guards, including the instant session invalidation of suspended clients.
2. Verify B2B client status restrictions (suspension blocks login, restriction disables form submission).
3. Verify B2B client creation, login, and resource request building.
4. Verify multi-recipient Resend email dispatches.
5. Verify QR code gate scanning, manual PIN lookup, and check-in/check-out logging.
