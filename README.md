# Previon

Previon is a tool for visualizing Active Directory attack paths. It uses data from SharpHound or BloodHound to help you map out AD relationships and find ways to escalate privileges.

![Main Dashboard](<!-- INSERT DASHBOARD SCREENSHOT HERE -->)

## Table of Contents

- [What is it for?](#what-is-it-for)
- [How is it different from BloodHound?](#how-is-it-different-from-bloodhound)
- [Features](#features)
- [Setup](#setup)
- [Usage](#usage)

## What is it for?

- **Red Teaming & Pentesting:** Find the easiest or shortest path to compromise a target (like Domain Admin) and keep track of your notes and looted credentials.
- **Blue Teaming & Defense:** See what an attacker could reach if a specific account is compromised (blast radius), or find the main choke points in your AD network that need to be fixed.

## How is it different from BloodHound?

| Feature | BloodHound | Previon |
| :--- | :--- | :--- |
| **Path Weights** | All paths are treated the same. | Assigns "weights" to different attacks. It can prioritize quiet attacks (like Group Membership) over noisy ones (like DCSync). |
| **Multiple Starting Points** | Finds paths from one node to another. | Can find the easiest path to a target starting from *all* the nodes you currently control. |
| **Keeping Track** | Mainly just for viewing the graph. | Lets you save hashes, passwords, and notes directly on the nodes. It saves your progress locally. |
| **Finding Bottlenecks** | Need to write custom Cypher queries. | Automatically highlights the nodes that show up in the most attack paths. |

## Features

### 1. Pathfinding

It can calculate different types of paths:

- **Shortest Path:** Finds the path with the fewest steps.
- **Easiest Path:** Tries to find paths that require less complex or noisy exploits based on hardcoded weights.
- **Paths from Owned:** Automatically finds the best route to your target from any node you've already compromised.

![Pathfinding](<!-- INSERT PATHFINDING SCREENSHOT HERE -->)

### 2. Note Taking and State

- **Loot:** Save credentials or hashes on the computers or users you compromise.
- **Notes:** Write down what you find on each node.
- **Persistence:** Everything is saved to a local file (`data/state.json`), so if you close the tool, your data is still there when you open it again.

![Notes and Loot](<!-- INSERT NODE PROPERTIES SCREENSHOT HERE -->)

### 3. Impact and Choke Points

- **Impact Analysis:** See all the nodes you can reach from a single starting point.
- **Choke Points:** Shows you the most common nodes used in attack paths so defenders know what to fix first.

![Choke Points](<!-- INSERT CHOKEPOINT SCREENSHOT HERE -->)

### 4. Graph Visuals

- Highlights important nodes like Domain Admins and Domain Controllers.
- Shows Group Policy links and ADCS objects.

## Setup

1. **Clone the repo:**

   ```bash
   git clone <your-repo-link>
   cd AD
   ```

2. **Install requirements:**

   ```bash
   pip install -r requirements.txt
   ```

   *(Requires: `flask`, `networkx`, `scipy`)*

3. **Start the app:**

   ```bash
   python app.py
   ```

4. **Open in browser:**
   Go to `http://127.0.0.1:5000`

## Usage

1. **Load Data:** Click the file icon in the top right to upload your SharpHound `.json` file.
2. **Mark Owned:** Right-click on a node you control and click "Mark as Owned".
3. **Find Paths:** Use the sidebar to set a Target and click "Trace Fastest Path" or "Trace Stealthiest Path".
4. **Save Loot:** Click on a node to open the side panel where you can type in notes and hashes.

![Usage](<!-- INSERT UPLOAD & OWNED SCREENSHOT HERE -->)
