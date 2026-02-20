/**
 * @process central-tauri-build
 * @description Full build process for CentralTauri — macOS desktop app for orchestrating parallel Claude Code agents.
 * Tauri v2 + React 19 + TypeScript strict + Zustand + shadcn/ui. 9 quality-gated phases with screenshot verification.
 * @inputs { projectPath: string, planPath: string, claudeMdPath: string }
 * @outputs { success: boolean, phasesCompleted: number, artifacts: array }
 */

import { defineTask } from '@a5c-ai/babysitter-sdk';

export async function process(inputs, ctx) {
  const {
    projectPath = '/Users/agam/dev/CentralTauri',
    planPath = '/Users/agam/dev/CentralTauri/PLAN.md',
    claudeMdPath = '/Users/agam/dev/CentralTauri/CLAUDE.md'
  } = inputs;

  const phases = [
    {
      id: 'phase-1-setup',
      name: 'Project Setup',
      description: `Scaffold Tauri v2 + React 19 + TypeScript project. Configure Vite (clearScreen: false, strictPort: true, port 1420). Install and configure: ESLint, Prettier, clippy, rustfmt, shadcn/ui (dark theme CSS vars), Zustand, neverthrow, lucide-react. Add git2-rs with vendored features to Cargo.toml. Set up SQLite via Tauri plugin with initial schema (projects, agent_sessions, messages, app_settings tables). Set up vitest. Verify pnpm tauri dev runs clean.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && pnpm tauri dev --no-watch 2>&1 | head -50',
      screenshotDescription: 'Default Tauri welcome page renders in the app window',
      tasks: [
        'pnpm create tauri-app with React + TypeScript template',
        'Configure Vite for Tauri (clearScreen, strictPort, envPrefix)',
        'Set up ESLint + Prettier + clippy + rustfmt',
        'Install shadcn/ui, configure dark theme CSS variables in globals.css',
        'Add Zustand, neverthrow, lucide-react',
        'Add git2-rs to Cargo.toml with vendored-libgit2 + vendored-openssl',
        'Set up SQLite via Tauri plugin, create initial schema',
        'Set up vitest',
        'Verify pnpm tauri dev runs clean'
      ]
    },
    {
      id: 'phase-2-layout',
      name: 'Core Layout + Projects',
      description: `Three-pane layout with shadcn/ui ResizablePanelGroup (left: projects, middle: chat placeholder, right: files placeholder). Left pane: project list with "Add Project" button. Folder picker via Tauri dialog API. Project CRUD (add, rename, soft-delete) with SQLite persistence. Empty state CTA "Add your first project". Zustand project store with selective subscriptions. Design language: Linear/Raycast inspired, dark theme with HSL vars from PLAN.md (bg hsl(224,71%,4%), surface hsl(224,71%,6%), etc). Inter font for UI (13px), JetBrains Mono for code. 4px spacing base, 1px borders, no shadows.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && pnpm tsc --noEmit && pnpm eslint src/',
      screenshotDescription: 'Three-pane layout with dark theme, left pane showing empty project list with Add Project button and CTA',
      tasks: [
        'Three-pane layout with ResizablePanelGroup',
        'Left pane: project list with Add Project button',
        'Folder picker via Tauri dialog API',
        'Project CRUD with SQLite persistence',
        'Empty state CTA',
        'Zustand project store with persistence',
        'Dark theme with design tokens from PLAN.md'
      ]
    },
    {
      id: 'phase-3-agents',
      name: 'Agent Orchestration',
      description: `Node.js sidecar setup with Claude Agent SDK (@anthropic-ai/claude-code). The sidecar is a compiled Node.js binary in bundle.externalBin that receives commands via stdin (JSON-lines) and streams responses via stdout. Rust sidecar manager: spawn, route messages, abort agents via AbortController. Use Tauri v2 Channels API (NOT events) for streaming agent output to frontend. Agent session CRUD in SQLite (AgentSession: id, project_id, status, prompt, model, sdk_session_id, created_at, ended_at). Zustand agent store: session state, status tracking. Chat pane: prompt input → launch agent → stream response. Chat UI: assistant message bubbles + collapsible tool calls + expandable thinking sections. Message queue: type while agent is running, queue is visible/editable/cancellable. Status enum: running → completed | failed | aborted | interrupted.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && cargo test --manifest-path src-tauri/Cargo.toml 2>&1 | tail -20 && pnpm tsc --noEmit',
      screenshotDescription: 'Chat pane with prompt input at bottom, a project selected in left pane. Middle pane shows chat area ready for input.',
      tasks: [
        'Node.js sidecar setup with Claude Agent SDK',
        'Rust sidecar manager: spawn, route messages, abort',
        'Tauri Channels for streaming agent output to frontend',
        'Agent session CRUD in SQLite',
        'Zustand agent store: session state, status tracking',
        'Chat pane: prompt input → launch agent → stream response',
        'Chat UI: message bubbles + collapsible tool calls + expandable thinking',
        'AbortController integration for cancellation',
        'Message queue: type while agent running, queue visible/editable/cancellable'
      ]
    },
    {
      id: 'phase-4-monitoring',
      name: 'Agent Monitoring + Switching',
      description: `Left pane: agents nested under projects with status badges (running=spinner, completed=green dot, failed=red dot, aborted=gray dot). Click agent → switch chat + right pane context. Preserve scroll position and chat state per agent using Zustand per-agent state. Use React useTransition for agent switching to keep UI responsive. macOS notifications on agent completion/failure (Tauri notification plugin). Performance: selective Zustand subscriptions, only render visible agent's stream. Throttle/virtualize rendering for 5 agents streaming.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && pnpm tsc --noEmit && pnpm eslint src/',
      screenshotDescription: 'Left pane showing project with nested agent sessions, each with colored status badges. One agent selected showing its chat.',
      tasks: [
        'Left pane: agents nested under projects with status badges',
        'Click agent → switch chat + right pane context',
        'Preserve scroll position and chat state per agent',
        'Status badges: running (spinner), completed (green), failed (red), aborted (gray)',
        'macOS notifications on completion/failure',
        'Performance: selective subscriptions, only render visible agent stream'
      ]
    },
    {
      id: 'phase-5-files',
      name: 'File Viewer + Git',
      description: `Right pane file tree via git2-rs (Tauri commands: get_file_tree, get_git_status, get_file_content, get_diff). Changed files highlighted in tree (modified=yellow, added=green, deleted=red indicators). CodeMirror 6 viewer: read-only (EditorState.readOnly.of(true) + EditorView.editable.of(false)), dynamic language switching via Compartment. Diff view for changed files. Git status display (branch, ahead/behind). Theme CodeMirror to match dark palette via CSS variables. IMPORTANT: open new Repository instance per Tauri command handler (git2-rs !Send/!Sync). Call view.destroy() on unmount. Set explicit height + overflow on CodeMirror.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && cargo test --manifest-path src-tauri/Cargo.toml && pnpm tsc --noEmit',
      screenshotDescription: 'Right pane showing file tree with git status indicators, a file selected showing syntax-highlighted code in CodeMirror viewer, branch info at top.',
      tasks: [
        'Right pane file tree via git2-rs Tauri commands',
        'Changed files highlighted in tree',
        'CodeMirror 6 viewer: read-only, dynamic language via Compartment',
        'Diff view for changed files',
        'Git status, branch info display',
        'Theme CodeMirror to match dark palette'
      ]
    },
    {
      id: 'phase-6-terminal',
      name: 'Terminal',
      description: `xterm.js v5 setup with @xterm/xterm and addons: @xterm/addon-fit, @xterm/addon-web-links, @xterm/addon-webgl. portable-pty in Rust backend for real PTY. PTY spawn/resize/write via Tauri Channels API (NOT events). ResizeObserver → debounced fit → resize PTY. Terminal placed in right pane below file viewer in resizable split. One terminal per project (not per agent). IMPORTANT: call term.dispose() on unmount, don't call fit() before container is visible.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && cargo test --manifest-path src-tauri/Cargo.toml && pnpm tsc --noEmit',
      screenshotDescription: 'Right pane split: file viewer on top, terminal on bottom showing a shell prompt. Terminal has dark theme matching app.',
      tasks: [
        'xterm.js setup with fit, web-links, webgl addons',
        'portable-pty in Rust backend',
        'PTY spawn/resize/write via Tauri Channels',
        'ResizeObserver → debounced fit → PTY resize',
        'Terminal in right pane below file viewer, resizable split'
      ]
    },
    {
      id: 'phase-7-polish',
      name: 'Crash Recovery + Polish',
      description: `Persist all session state to SQLite on every message (append-only messages with full detail: content + thinking + tool_calls + usage). On restart: restore sessions from SQLite, mark previously-running sessions as interrupted. Orphan sidecar process cleanup on app quit (register cleanup handler, track all child PIDs, force-kill on shutdown). Agent timeout handling (configurable timeout, AbortController). React error boundaries for all major panes. Loading/empty states for all panes. Performance audit considerations for 5 concurrent agents.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && cargo test --manifest-path src-tauri/Cargo.toml && pnpm tsc --noEmit && pnpm eslint src/',
      screenshotDescription: 'App showing multiple agents in various states (one running, one completed, one failed), demonstrating robust state handling and polished UI.',
      tasks: [
        'Persist all session state to SQLite on every message',
        'On restart: restore sessions, mark running→interrupted',
        'Orphan process cleanup on app quit',
        'Agent timeout handling',
        'Error boundaries for React',
        'Loading/empty states for all panes',
        'Performance audit with 5 concurrent agents'
      ]
    },
    {
      id: 'phase-8-testing',
      name: 'Testing',
      description: `Rust unit tests: git2-rs wrappers (status, diff, log), sidecar manager (spawn/kill), PTY management. TypeScript unit tests (vitest): Zustand store logic (agent store, project store), neverthrow error handling patterns, message queue operations, session restore logic. Integration tests: agent lifecycle (spawn → stream → complete/fail/abort), parallelism (multiple agents, switching), crash recovery (persist → restore). UI tests: critical interactions only — agent launch, switching, status updates. No tests for: pure UI layout, styling, static components.`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && cargo test --manifest-path src-tauri/Cargo.toml && pnpm vitest run',
      screenshotDescription: 'Terminal output showing all tests passing (Rust + vitest), or the app running stably with test results visible.',
      tasks: [
        'Rust unit tests: git2-rs wrappers, sidecar manager, PTY management',
        'TS vitest: agent store logic, message queue, session restore',
        'Integration: agent lifecycle end-to-end',
        'Integration: parallelism (multiple agents, switching)',
        'Integration: crash recovery (persist → restore)',
        'UI tests: agent launch, switching, status updates'
      ]
    },
    {
      id: 'phase-9-design-polish',
      name: 'Design Polish — Native macOS Feel',
      description: `Make the app look and feel like a native macOS IDE (reference: Cursor/Conductor workspace UI) rather than a default shadcn/ui web app. Key changes:

REFERENCE IMAGE ANALYSIS (Conductor workspace):
- Background: Very dark (#0d0d0d to #111111 range), darker than current shadcn default
- Borders: Ultra-subtle, barely visible — ~5-8% opacity white or very dark gray (e.g., hsl(0 0% 15%)), NOT the current 17% lightness blue-gray
- Selected items: Subtle background shift (slightly lighter surface), no harsh outlines or bright highlights
- Text hierarchy: Primary text ~85% white, secondary ~50% white, tertiary ~35% white — all muted, no pure white anywhere
- Panels: Differentiated by very slight background shade (1-2% difference), not by borders
- Inputs: Dark background with very subtle border, muted placeholder text, slightly rounded
- Tab bars: Plain text tabs, minimal — no shadcn Tab styling. Active tab slightly lighter, inactive very muted
- Buttons: Ghost-style by default, very subtle hover states
- Empty states: Simple centered text, no heavy illustrations or boxes
- Scrollbars: Thin, dark, auto-hide
- Overall: Zero shadows, completely flat, feels like part of the OS not a web page

SPECIFIC TASKS:
1. Update globals.css HSL variables: darken background to ~hsl(0 0% 5%), surface to hsl(0 0% 7%), reduce border contrast to ~hsl(0 0% 12-15%), desaturate everything (move from blue-tinted to neutral dark)
2. Update ResizableHandle to be 1px hairline, nearly invisible
3. Refine sidebar: items should have subtle rounded hover states, selected state is slightly lighter bg not bold/bright
4. Chat input area: dark bg, subtle border, rounded corners, placeholder text very muted
5. Terminal tab bar: plain text, minimal, no shadcn Tab component overhead
6. Message bubbles: remove any boxy card styling, use subtle bg difference only
7. File tree: tighten spacing, ensure git status dots are small and refined
8. Status badges: smaller, more refined, match native macOS aesthetic
9. Custom thin scrollbar CSS (webkit-scrollbar) for all scrollable areas
10. Ensure all hover/focus states are subtle and not flashy
11. Remove any remaining default shadcn visual artifacts (large border-radius, heavy shadows, etc.)
12. Add subtle CSS transitions (150ms) for hover/active states to feel polished`,
      verifyCommand: 'cd /Users/agam/dev/CentralTauri && pnpm tsc --noEmit && pnpm eslint src/',
      screenshotDescription: 'App with refined native-macOS-feeling dark theme: ultra-subtle borders, muted color hierarchy, no shadcn visual artifacts, feels like Cursor/Conductor not a web app.',
      tasks: [
        'Update globals.css: darker bg, desaturated palette, ultra-subtle borders',
        'Refine ResizableHandle to 1px hairline',
        'Refine sidebar: subtle hover/selected states, tighter spacing',
        'Refine chat input and message bubbles',
        'Refine terminal tab bar to plain minimal style',
        'Custom thin scrollbars (webkit)',
        'Subtle CSS transitions for all interactive states',
        'Ensure file tree, status badges, empty states match native feel',
        'Screenshot comparison with reference image to verify'
      ]
    }
  ];

  const phaseResults = [];

  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];

    // ========================================================================
    // STEP 1: IMPLEMENT PHASE
    // ========================================================================

    const implementResult = await ctx.task(implementPhaseTask, {
      projectPath,
      planPath,
      claudeMdPath,
      phase,
      phaseIndex: i + 1,
      totalPhases: phases.length,
      previousPhases: phaseResults.map(r => ({ id: r.phaseId, name: r.phaseName, summary: r.implementSummary }))
    });

    // ========================================================================
    // STEP 2: BUILD VERIFICATION
    // ========================================================================

    const buildResult = await ctx.task(buildVerifyTask, {
      projectPath,
      phase,
      verifyCommand: phase.verifyCommand
    });

    // ========================================================================
    // STEP 3: SCREENSHOT VERIFICATION (run app, take screenshot with Playwright)
    // ========================================================================

    const screenshotResult = await ctx.task(screenshotVerifyTask, {
      projectPath,
      phase,
      screenshotDescription: phase.screenshotDescription,
      phaseIndex: i + 1
    });

    // ========================================================================
    // STEP 4: QUALITY SCORING
    // ========================================================================

    const qualityResult = await ctx.task(qualityScoreTask, {
      projectPath,
      phase,
      implementResult,
      buildResult,
      screenshotResult,
      phaseIndex: i + 1
    });

    // ========================================================================
    // STEP 5: ITERATIVE FIX LOOP (if quality < 80 or build failed)
    // ========================================================================

    let finalQuality = qualityResult.score;
    let fixIterations = 0;
    const maxFixIterations = 3;

    while ((finalQuality < 80 || !buildResult.success) && fixIterations < maxFixIterations) {
      fixIterations++;

      const fixResult = await ctx.task(fixIssuesTask, {
        projectPath,
        planPath,
        claudeMdPath,
        phase,
        qualityResult,
        buildResult,
        screenshotResult,
        fixIteration: fixIterations
      });

      // Re-verify build
      const reBuildResult = await ctx.task(buildVerifyTask, {
        projectPath,
        phase,
        verifyCommand: phase.verifyCommand
      });

      // Re-screenshot
      const reScreenshotResult = await ctx.task(screenshotVerifyTask, {
        projectPath,
        phase,
        screenshotDescription: phase.screenshotDescription,
        phaseIndex: i + 1
      });

      // Re-score
      const reQualityResult = await ctx.task(qualityScoreTask, {
        projectPath,
        phase,
        implementResult: fixResult,
        buildResult: reBuildResult,
        screenshotResult: reScreenshotResult,
        phaseIndex: i + 1
      });

      finalQuality = reQualityResult.score;
    }

    // ========================================================================
    // STEP 6: HUMAN REVIEW BREAKPOINT
    // ========================================================================

    await ctx.breakpoint({
      question: `Phase ${i + 1}/${phases.length}: "${phase.name}" complete. Quality: ${finalQuality}/100. Fix iterations: ${fixIterations}. Build: ${buildResult.success ? 'PASS' : 'FAIL'}. Review and approve to continue?`,
      title: `Phase ${i + 1}: ${phase.name} Review`,
      context: {
        runId: ctx.runId,
        files: [
          { path: `artifacts/${phase.id}/screenshot.png`, format: 'image', label: 'UI Screenshot' },
          { path: `artifacts/${phase.id}/summary.md`, format: 'markdown', label: 'Phase Summary' }
        ]
      }
    });

    // ========================================================================
    // STEP 7: GIT COMMIT
    // ========================================================================

    const commitResult = await ctx.task(gitCommitTask, {
      projectPath,
      phase,
      phaseIndex: i + 1
    });

    phaseResults.push({
      phaseId: phase.id,
      phaseName: phase.name,
      quality: finalQuality,
      buildSuccess: buildResult.success,
      fixIterations,
      implementSummary: implementResult.summary || `Phase ${i + 1} implemented`,
      commitHash: commitResult.hash || 'unknown'
    });
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================

  const allPassed = phaseResults.every(r => r.quality >= 80 && r.buildSuccess);

  await ctx.breakpoint({
    question: `Build complete! ${phaseResults.filter(r => r.quality >= 80).length}/${phases.length} phases passed quality gate. Overall: ${allPassed ? 'SUCCESS' : 'NEEDS ATTENTION'}. Final review?`,
    title: 'CentralTauri Build Complete',
    context: {
      runId: ctx.runId,
      files: [
        { path: 'artifacts/final-summary.md', format: 'markdown', label: 'Final Summary' }
      ]
    }
  });

  return {
    success: allPassed,
    phasesCompleted: phaseResults.length,
    phaseResults,
    artifacts: phaseResults.map(r => `artifacts/${r.phaseId}/`),
    metadata: {
      processId: 'central-tauri-build',
      timestamp: ctx.now()
    }
  };
}

// ============================================================================
// TASK DEFINITIONS
// ============================================================================

export const implementPhaseTask = defineTask('implement-phase', (args, taskCtx) => ({
  kind: 'agent',
  title: `Implement: ${args.phase.name} (${args.phaseIndex}/${args.totalPhases})`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior full-stack engineer building a Tauri v2 + React 19 macOS desktop app',
      task: `Implement Phase ${args.phaseIndex}: ${args.phase.name}`,
      context: {
        projectPath: args.projectPath,
        planPath: args.planPath,
        claudeMdPath: args.claudeMdPath,
        phaseDescription: args.phase.description,
        phaseTasks: args.phase.tasks,
        previousPhases: args.previousPhases
      },
      instructions: [
        `Read PLAN.md at ${args.planPath} and CLAUDE.md at ${args.claudeMdPath} for full context`,
        `Implement ALL tasks for this phase: ${args.phase.tasks.join('; ')}`,
        `Follow the coding standards in CLAUDE.md strictly: functional paradigm, no classes, max 300 lines per file, max 50 lines per function`,
        'Feature-based file org: src/features/{agents,projects,files,terminal,settings}/',
        'Use Zustand with selectors, never bare useStore()',
        'Use neverthrow Result types for errors in TypeScript',
        'Write self-documenting code, comments only for "why"',
        'After implementation, verify it compiles: run pnpm tsc --noEmit',
        'Return a summary of files created/modified and what was accomplished'
      ],
      outputFormat: 'JSON with summary (string), filesCreated (array of strings), filesModified (array of strings), decisions (array of strings)'
    },
    outputSchema: {
      type: 'object',
      required: ['summary', 'filesCreated', 'filesModified'],
      properties: {
        summary: { type: 'string' },
        filesCreated: { type: 'array', items: { type: 'string' } },
        filesModified: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'implementation', args.phase.id]
}));

export const buildVerifyTask = defineTask('build-verify', (args, taskCtx) => ({
  kind: 'agent',
  title: `Build Verify: ${args.phase.name}`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Build verification engineer',
      task: `Verify the build for phase: ${args.phase.name}`,
      context: {
        projectPath: args.projectPath,
        verifyCommand: args.verifyCommand
      },
      instructions: [
        `cd to ${args.projectPath}`,
        'Run pnpm tsc --noEmit to check TypeScript compilation',
        'Run cargo clippy --manifest-path src-tauri/Cargo.toml to check Rust',
        `Run the phase-specific verify command if different`,
        'Report success/failure with details on any errors',
        'If there are errors, provide the exact error messages'
      ],
      outputFormat: 'JSON with success (boolean), errors (array of strings), output (string)'
    },
    outputSchema: {
      type: 'object',
      required: ['success'],
      properties: {
        success: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        output: { type: 'string' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'verification', 'build', args.phase.id]
}));

export const screenshotVerifyTask = defineTask('screenshot-verify', (args, taskCtx) => ({
  kind: 'agent',
  title: `Screenshot Verify: ${args.phase.name}`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'UI verification engineer for a Tauri desktop app',
      task: `Take a screenshot of the running app and verify the UI for phase: ${args.phase.name}`,
      context: {
        projectPath: args.projectPath,
        screenshotDescription: args.screenshotDescription,
        phaseIndex: args.phaseIndex
      },
      instructions: [
        `cd to ${args.projectPath}`,
        'Start the Vite dev server with: pnpm vite --port 1420 & (background it)',
        'Wait a few seconds for the server to start',
        'Install playwright if not already: npx playwright install chromium (only if needed)',
        'Use a simple Node.js script with Playwright to navigate to http://localhost:1420, wait for load, take a screenshot',
        `Save screenshot to ${args.projectPath}/.a5c/runs/artifacts/phase-${args.phaseIndex}-screenshot.png`,
        'Kill the dev server after screenshot',
        `Describe what you see in the screenshot and whether it matches: "${args.screenshotDescription}"`,
        'Return whether the UI matches expectations'
      ],
      outputFormat: 'JSON with matches (boolean), screenshotPath (string), description (string), issues (array of strings)'
    },
    outputSchema: {
      type: 'object',
      required: ['matches', 'description'],
      properties: {
        matches: { type: 'boolean' },
        screenshotPath: { type: 'string' },
        description: { type: 'string' },
        issues: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'verification', 'screenshot', args.phase.id]
}));

export const qualityScoreTask = defineTask('quality-score', (args, taskCtx) => ({
  kind: 'agent',
  title: `Quality Score: ${args.phase.name}`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior QA engineer and code reviewer',
      task: `Score the quality of Phase ${args.phaseIndex}: ${args.phase.name}`,
      context: {
        projectPath: args.projectPath,
        phase: args.phase,
        implementResult: args.implementResult,
        buildResult: args.buildResult,
        screenshotResult: args.screenshotResult
      },
      instructions: [
        'Review the implementation files created/modified',
        'Check adherence to CLAUDE.md coding standards (max 300 lines/file, max 50 lines/function, functional paradigm, no any types)',
        'Check if all phase tasks were completed',
        'Review build verification results',
        'Review screenshot verification results',
        'Score 0-100 based on: completeness (40%), code quality (30%), build success (20%), UI correctness (10%)',
        'Provide specific feedback on what needs improvement if score < 80'
      ],
      outputFormat: 'JSON with score (number 0-100), breakdown (object), feedback (string), recommendations (array of strings)'
    },
    outputSchema: {
      type: 'object',
      required: ['score'],
      properties: {
        score: { type: 'number', minimum: 0, maximum: 100 },
        breakdown: { type: 'object' },
        feedback: { type: 'string' },
        recommendations: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'quality', args.phase.id]
}));

export const fixIssuesTask = defineTask('fix-issues', (args, taskCtx) => ({
  kind: 'agent',
  title: `Fix Issues: ${args.phase.name} (attempt ${args.fixIteration})`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Senior full-stack engineer fixing issues in a Tauri v2 + React 19 app',
      task: `Fix issues found in Phase: ${args.phase.name} (fix iteration ${args.fixIteration})`,
      context: {
        projectPath: args.projectPath,
        planPath: args.planPath,
        claudeMdPath: args.claudeMdPath,
        phase: args.phase,
        qualityFeedback: args.qualityResult?.feedback,
        qualityRecommendations: args.qualityResult?.recommendations,
        buildErrors: args.buildResult?.errors,
        screenshotIssues: args.screenshotResult?.issues
      },
      instructions: [
        `Read CLAUDE.md at ${args.claudeMdPath} for coding standards`,
        'Fix all build errors first (highest priority)',
        'Then fix quality issues identified by the quality scorer',
        'Then fix UI issues from screenshot verification',
        'Follow all CLAUDE.md guardrails',
        'Verify fixes compile: pnpm tsc --noEmit',
        'Return summary of what was fixed'
      ],
      outputFormat: 'JSON with summary (string), filesModified (array of strings), issuesFixed (array of strings)'
    },
    outputSchema: {
      type: 'object',
      required: ['summary', 'filesModified'],
      properties: {
        summary: { type: 'string' },
        filesModified: { type: 'array', items: { type: 'string' } },
        issuesFixed: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'fix', args.phase.id, `attempt-${args.fixIteration}`]
}));

export const gitCommitTask = defineTask('git-commit', (args, taskCtx) => ({
  kind: 'agent',
  title: `Git Commit: Phase ${args.phaseIndex} - ${args.phase.name}`,
  agent: {
    name: 'general-purpose',
    prompt: {
      role: 'Developer committing clean phase work',
      task: `Create a git commit for Phase ${args.phaseIndex}: ${args.phase.name}`,
      context: {
        projectPath: args.projectPath,
        phaseName: args.phase.name,
        phaseIndex: args.phaseIndex
      },
      instructions: [
        `cd to ${args.projectPath}`,
        'Run git add -A to stage all changes',
        `Create commit with message: "Phase ${args.phaseIndex}: ${args.phase.name}"`,
        'Return the commit hash'
      ],
      outputFormat: 'JSON with hash (string), filesCommitted (number)'
    },
    outputSchema: {
      type: 'object',
      required: ['hash'],
      properties: {
        hash: { type: 'string' },
        filesCommitted: { type: 'number' }
      }
    }
  },
  io: {
    inputJsonPath: `tasks/${taskCtx.effectId}/input.json`,
    outputJsonPath: `tasks/${taskCtx.effectId}/result.json`
  },
  labels: ['agent', 'git', args.phase.id]
}));
