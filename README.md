### 2. The Setup Guide (`README.md`)
Create a file named **`README.md`** inside your repository. This makes your GitHub repository look clean and professional.

```markdown
# Poker Playstyle Matrix Trainer

An adaptive frontend tool designed to let you play against varying AI profiles (Aggressive, Passive, Tight-Aggressive) without revealing who is who. The profiles ingest imported hand history transcripts to dynamically calibrate to your real playstyle frequencies.

## Key Features
* **Blind Training Configuration:** Profiles are masked so you cannot anticipate their actions based on visible labels.
* **State Persistence:** Your player hole cards, current configuration, and active text sessions are saved instantly to local browser storage—safeguarding against accidental window closure.
* **Hand History Importer:** Paste standard table logs directly into the engine to automatically simulate tactical model updates.

## Setup Instructions for GitHub Pages
1. Go to your [GitHub Account](https://github.com) and create a **New Repository**.
2. Name the repository (e.g., `poker-playstyle-trainer`).
3. Set the repository visibility to **Public**.
4. Upload the `index.html` file into the main root directory of that repository.
5. In your GitHub repository, navigate to **Settings** (gear icon) -> **Pages** (on the left menu bar).
6. Under **Build and deployment**, set the Source drop-down to `Deploy from a branch`.
7. Choose the `main` or `master` branch from the drop-down menu, make sure the folder is set to `/ (root)`, and click **Save**.
8. Within 1–2 minutes, GitHub will generate a live URL where your personal application is hosted!
