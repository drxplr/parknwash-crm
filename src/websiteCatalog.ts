import type { Service } from './model'

// Verified against https://parknwash.ch/app.js on 2026-11-08.
// Each region/size is a separate bookable variant: this preserves the existing
// database and gives each quote its exact price and duration without guessing.
export const websitePackages = [
  {
    name: 'Essential Care',
    minutes: [60, 80, 90],
    Ticino: [80, 90, 100],
    Geneva: [90, 115, 130],
    includes: 'Exterior, windows, wheels, vacuuming, dashboard and screens.',
  },
  {
    name: 'Complete Care',
    minutes: [105, 125, 135],
    Ticino: [120, 130, 140],
    Geneva: [150, 175, 190],
    includes: 'Essential + interior windows, tyres, steering wheel and leather care.',
  },
  {
    name: 'Signature Care',
    minutes: [200, 220, 230],
    Ticino: [235, 250, 270],
    Geneva: [250, 275, 290],
    includes: 'Complete + detailed plastics, door seals, air vents and carpets.',
  },
] as const
export const sizeLabels: Record<string, string> = {
  Compact: 'S · compact',
  Sedan: 'M · sedan / mid-size SUV',
  Estate: 'M · estate',
  SUV: 'L+ · large SUV / performance',
}
export function websiteServices(): Service[] {
  return (['Ticino', 'Geneva'] as const).flatMap((region) =>
    websitePackages.flatMap((pkg) =>
      ['S', 'M', 'L+'].map((size, i) => ({
        id: crypto.randomUUID(),
        name: `${pkg.name} · ${region} · ${size}`,
        duration: pkg.minutes[i],
        price: pkg[region][i],
        tariffs: Object.fromEntries(
          (i === 0 ? ['Compact'] : i === 1 ? ['Sedan', 'Estate'] : ['SUV']).map((key) => [
            key,
            pkg[region][i],
          ]),
        ),
      })),
    ),
  )
}
export function serviceFits(service: Service, region: string, size: string) {
  const parts = service.name.split(' · ')
  return (
    parts.length !== 3 ||
    !websitePackages.some((p) => p.name === parts[0]) ||
    (parts[1] === region && (!size || service.tariffs[size] != null))
  )
}
