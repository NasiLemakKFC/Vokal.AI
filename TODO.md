# Antigravity Agent Setup Instructions: AI Mock Interview Coach

## Context for Agent
You are an autonomous AI coding assistant (Google Antigravity Agent). 
Your objective is to scaffold the frontend web environment for the "AI Mock Interview Coach", a real-time multimodal application. 
The architecture relies on client-side browser processing for Computer Vision (MediaPipe) to reduce latency, and a separate Python/FastAPI backend (which will be built later) for Audio/NLP.

**Tech Stack Requirements:**
*   **Framework:** Next.js (App Router)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS + standard Lucide React icons
*   **Vision AI (Client-side):** Google MediaPipe Face Mesh

---

## 🛠️ Phase 1: Initialize the Project & Dependencies
**Agent Instructions:** Open the terminal and execute the following commands to initialize the web environment.

- [ ] Run the Next.js scaffold command (use default yes for TypeScript, Tailwind, ESLint, App Router): 
      `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
- [ ] Navigate into the `frontend` directory: `cd frontend`
- [ ] Install the specific MediaPipe Vision and Camera dependencies:
      `npm install @mediapipe/tasks-vision @mediapipe/camera_utils`
- [ ] Install UI libraries (Framer Motion for visual nudges, Lucide for icons):
      `npm install framer-motion lucide-react`
- [ ] Clean up `src/app/globals.css` (keep only the Tailwind directives) and remove default boilerplate from `src/app/page.tsx`.

---

## 📁 Phase 2: Scaffold Project Structure & Files
**Agent Instructions:** Create the following directory structure and placeholder files inside the `frontend/src` directory. Ensure files are heavily commented so the human developers know where to integrate the logic later.

- [ ] **Create Directory Structure:**
  - `src/components/interview/` (For UI components)
  - `src/components/dashboard/` (For lecturer/student views)
  - `src/hooks/` (For custom React hooks)
  - `src/lib/vision/` (For MediaPipe initialization)

- [ ] **Create File: `src/lib/vision/MediaPipeSetup.ts`**
  - *Goal:* Write a boilerplate TypeScript class or function to initialize `FaceLandmarker` from `@mediapipe/tasks-vision`. Include comments stating: *"TODO: Configure refineLandmarks: true to capture exact iris positions for eye-contact tracking."*

- [ ] **Create File: `src/hooks/useFaceMesh.ts`**
  - *Goal:* Create a custom React hook that will eventually tie the webcam video feed (HTMLVideoElement) to the MediaPipe inference loop using `requestAnimationFrame`. 

- [ ] **Create File: `src/components/interview/WebcamFeed.tsx`**
  - *Goal:* Build a React component that requests webcam permissions via `navigator.mediaDevices.getUserMedia` and renders a `<video>` tag.
  - Include an overlay `<canvas>` tag positioned absolutely over the video (this will be used later to draw the 478 face mesh points during debugging).

- [ ] **Create File: `src/components/interview/VisualNudge.tsx`**
  - *Goal:* Build a UI component (using Framer Motion) that flashes a warning (e.g., "⚠️ Please maintain eye contact") when a boolean prop `isEyeContactLost` is passed as true.

- [ ] **Create File: `src/app/page.tsx` (Update)**
  - *Goal:* Import the `WebcamFeed` and `VisualNudge` components into a clean, modern, dark-mode layout to serve as the main practice room for the student.

---

## 🛑 Checkpoint & Testing
**Agent Instructions:** Once Phase 1 and 2 are complete:
- [ ] Run `npm run dev`.
- [ ] Verify that the local server compiles without TypeScript errors.
- [ ] Send a message to the human user saying: *"Phase 1 and 2 are complete. The Next.js frontend, Tailwind CSS, and MediaPipe hooks have been scaffolded. Let me know when you are ready to write the eye-tracking mathematics."*