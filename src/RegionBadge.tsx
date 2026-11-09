export function RegionBadge({ region }: { region: string }) {
  return (
    <span className={`region-badge region-${region.toLowerCase()}`}>
      <span aria-hidden="true" />
      {region === 'Unassigned' ? 'Region not set' : region}
    </span>
  )
}
