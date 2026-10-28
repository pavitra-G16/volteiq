# VolteIQ Hackathon Submission Checklist

**Final deadline: 4 November 2026, 6:30 PM IST (Asia/Kolkata).**

## Public repository

- [ ] Create or confirm the public GitHub repository and verify the correct source is present.
- [ ] The supplied project folder currently has no `.git` directory or inspectable commit history. Initialize/connect the intended repository manually; preserve genuine history if you have the original clone. Do not fabricate, backdate, or rewrite commits to imply hackathon activity.
- [ ] Review the official hackathon rules and permitted development window before creating/pushing commits. Keep commits truthful and within the rules.
- [ ] Confirm `.env`, credentials, local databases, virtual environments, `node_modules`, build output, test caches, and personal file paths are absent from the published repository. Keep `.env.example` and `frontend/.env.local.example`.
- [ ] Clone the public repository into a clean directory and run the documented setup and checks.
- [ ] Confirm the public repository URL works for judges and the README reflects only verified behavior.

## 2–3 minute demo video

- [ ] Record a 2–3 minute walkthrough on YouTube or Loom.
- [ ] Open on the VolteIQ landing page, orbit the 3D home, select a node, then move into the real dashboard workflow.
- [ ] Use a real bill sample only with permission to share it; hide account identifiers and unrelated personal information.
- [ ] Demonstrate OCR only on the machine where `/api/v1/health` confirms Tesseract is available, then review/correct and explicitly verify the extracted fields.
- [ ] Show the tariff estimate separately from the bill total, explain recommendation assumptions, commit an action, and show analytics from saved records.
- [ ] State that later bill changes are observed and not proof of recommendation causality.
- [ ] Set the video to **unlisted** and verify the share link opens in a private/logged-out browser window.
- [ ] Add the video link to the official submission form.

## Accessible pitch deck

- [ ] Prepare and export a PDF pitch deck of **10 slides maximum**.
- [ ] Check reading order, selectable text, meaningful slide titles, contrast, font size, and alternative text for meaningful visuals.
- [ ] Keep tariff, OCR, solar, savings, test and deployment claims aligned with the implemented product and actual evidence.
- [ ] Open the exported PDF and review every page at presentation size before submission.
- [ ] Add the accessible PDF to the official submission form or repository location requested by the organizers.

## Final submission

- [ ] Re-run backend tests, frontend lint, TypeScript checks and production build from a clean checkout.
- [ ] Confirm real OCR on the presentation machine with an actual sample bill; this current workspace cannot verify real OCR because Tesseract and a bill image are absent.
- [ ] Verify the repository URL, unlisted video URL, PDF and team/project details in the submission form.
- [ ] Submit before **4 November 2026 at 6:30 PM IST** and save the confirmation/receipt.
