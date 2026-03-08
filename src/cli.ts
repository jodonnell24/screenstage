function printHelp(): void {
  console.log(`motion-creator

Usage:
  motion-creator run <config-path>
  motion-creator init [directory]
`);
}

function main(): void {
  const command = process.argv[2];

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "run" || command === "init") {
    console.log(`Command '${command}' is scaffolded and will be implemented next.`);
    return;
  }

  printHelp();
  process.exitCode = 1;
}

main();
