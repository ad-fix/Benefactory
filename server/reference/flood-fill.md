# Flood-fill utilities (removed from GameRoom.ts)

These were used solely by `calculateScores()` to find connected regions of painted grid cells per player color. Saved here as a pattern reference.

```typescript
private findConnectedComponents(
  color: PlayerColor
): Array<Array<{ x: number; y: number }>> {
  const visited = new Set<string>();
  const components: Array<Array<{ x: number; y: number }>> = [];

  for (const [key, cell] of this.state.gridColors) {
    if (cell.color !== color || visited.has(key)) continue;

    const [x, y] = key.split(",").map(Number);
    const component = this.bfs(x, y, color, visited);

    if (component.length > 0) {
      components.push(component);
    }
  }

  return components;
}

private bfs(
  startX: number,
  startY: number,
  color: PlayerColor,
  visited: Set<string>
): Array<{ x: number; y: number }> {
  const queue: Array<{ x: number; y: number }> = [
    { x: startX, y: startY },
  ];
  const component: Array<{ x: number; y: number }> = [];
  const startKey = `${startX},${startY}`;

  visited.add(startKey);

  while (queue.length > 0) {
    const current = queue.shift()!;
    component.push(current);

    const neighbors = [
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
    ];

    for (const neighbor of neighbors) {
      const key = `${neighbor.x},${neighbor.y}`;

      if (visited.has(key)) continue;

      const cell = this.state.gridColors.get(key);
      if (cell && cell.color === color) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  return component;
}
```
