export type McpPlatform = "macos" | "windows" | "linux" | "unknown";

export interface McpSetupCard {
  name: string;
  command: string;
  note: string;
}

export function detectMcpPlatform(): McpPlatform {
  if (typeof navigator === "undefined") return "unknown";

  const platform =
    "userAgentData" in navigator
      ? (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
      : navigator.platform;
  const value = `${platform ?? ""} ${navigator.userAgent}`.toLowerCase();

  if (value.includes("win")) return "windows";
  if (value.includes("mac")) return "macos";
  if (value.includes("linux")) return "linux";
  return "unknown";
}

export function getMcpCommand(platform: McpPlatform): string {
  return platform === "windows" ? "slatevault-mcp.exe" : "slatevault-mcp";
}

export function getMcpInstallCheck(platform: McpPlatform): string {
  if (platform === "windows") {
    return "where slatevault-mcp.exe\nslatevault-mcp.exe --help";
  }

  return "which slatevault-mcp\nslatevault-mcp --help";
}

export function getMcpInstallNote(platform: McpPlatform): string {
  if (platform === "windows") {
    return "The Windows installer adds the app install folder to your user PATH. Open a new terminal or restart your AI app after installing.";
  }

  if (platform === "macos") {
    return "The macOS installer places the MCP command at /usr/local/bin/slatevault-mcp.";
  }

  return "Install slateVault first, then make sure the slatevault-mcp command is available on PATH.";
}

export function getGenericMcpConfig(platform: McpPlatform): string {
  const command = getMcpCommand(platform);
  return JSON.stringify(
    {
      mcpServers: {
        slatevault: {
          command,
          args: [],
        },
      },
    },
    null,
    2
  );
}

export function getMcpSetupCards(platform: McpPlatform): McpSetupCard[] {
  const command = getMcpCommand(platform);

  return [
    {
      name: "Claude Code",
      command: `claude mcp add -s user slatevault -- ${command}`,
      note: "Run this once in a fresh terminal, then restart Claude Code if it was already open.",
    },
    {
      name: "Generic MCP client",
      command: getGenericMcpConfig(platform),
      note: "Use this shape for tools that ask for an MCP server JSON config.",
    },
    {
      name: "Command check",
      command: getMcpInstallCheck(platform),
      note: "Run this first if your AI tool cannot find the slateVault MCP server.",
    },
  ];
}
