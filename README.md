# Aurora — a weather app you look *through*

An Expo / React Native weather app whose background is a live simulation of the
current weather rather than a picture of it. Fourteen conditions, each with day,
golden-hour and night variants, composed from independent animated layers and
cross-faded into one another.

---

## 📲 Download for Android

[**⬇️ Get the latest APK**](https://github.com/DiasLezdo/react_native_expo_learning_weather_app/releases/latest)

<sub>Android 7.0+ · arm64-v8a and armeabi-v7a · no account required</sub>

Android will warn you about installing outside the Play Store. That's expected for a
directly distributed APK:

1. Download the `.apk` on your phone
2. Tap it — Android will ask permission to install from this source
3. Allow, then tap **Install**

> **The weather is simulated.** This build ships with a mock data source: forecasts are
> generated locally from a climate model, not fetched from a weather service. They are
> plausible and internally consistent, but they are not real. See
> [plugging in the real API](ARCHITECTURE.md#the-seam).

iOS isn't published yet. The project builds for it — it needs an Apple Developer account.

---

## Running it yourself

```bash
npm install
npx expo start
```

Runs in Expo Go — no development build required (location and sharing excepted).

📄 **[ARCHITECTURE.md](ARCHITECTURE.md)** — full technical documentation: architecture,
the sky engine, performance model, every Expo API used and where, the data layer, and
how to extend it.

---

## The idea

Most weather apps put a static gradient behind a card stack. Here the sky *is*
the app: content floats over a full-bleed simulation, scrolling reads as
descending through the atmosphere, and every saved city renders its own live
weather inside its row on the Cities screen.

**Three screens**

| Screen | What it is |
| --- | --- |
| **Today** | Hero temperature, hourly ribbon, 10-day outlook, daylight arc, metric tiles |
| **Cities** | Saved places, each with a live miniature sky; search to add |
| **Sky** | Preview any condition on demand, plus quality and unit settings |

---

## How the animation stays smooth

The hard constraint is that hundreds of particles must move while the device is
also scrolling a list. The approach:

**Everything loops natively.** Rain, snow, clouds, stars, fog, lightning and the
rest are Reanimated 4 **CSS keyframe animations** (`animationName`,
`animationDuration`, `animationIterationCount`). These are evaluated on the
native side — 160 raindrops cost **zero JavaScript per frame**. The same field
built from `useAnimatedStyle` would mean 160 worklet evaluations every frame.

**Particles start pre-distributed.** Each one gets a *negative* `animationDelay`
— CSS semantics for "begin partway through" — so the field is full on the first
frame instead of filling in over one cycle. This is what makes a 90-second cloud
drift viable at all.

**Fields are deterministic.** Layers scatter from a seeded PRNG (`lib/rng.ts`)
keyed on the place id, so re-renders never reshuffle the sky and a given city
always looks like itself.

**Continuous inputs are quantised.** Wind, intensity and sun angle are rounded
before they reach the layers, so a hundredth-of-a-degree change in sun position
can't invalidate a memo and rebuild 200 views.

**No live blur.** A `BlurView` over a continuously animating background re-blurs
every frame — the single most expensive thing this app could do. Glass surfaces
are layered translucency plus a hairline sheen instead.

**Quality tiers.** `high` / `balanced` / `battery` scale every particle count
from one place (`QUALITY_SCALE`). City cards run at `battery`, so five
simultaneous simulations cost about as much as one full-screen one.

**Scroll is UI-thread.** The hero's parallax, shrink and dissolve — and the
compact header condensing out of it — are driven from one shared scroll value,
so the handoff stays locked to the finger.

**The tab dock is draggable.** Press anywhere on it and slide: the indicator
tracks your finger continuously and snaps to the nearest slot on release, with
each slot swelling as the indicator nears it. The gesture runs entirely on the
UI thread from one fractional-slot `position` value; only slot *crossings* call
back into JS, for the haptic tick and the label highlight, so a drag costs two
or three JS calls rather than one per frame. Tapping still works — the pan only
claims the gesture after 8px of horizontal travel.

---

## Plugging in the real API

Screens never see vendor JSON. There is exactly one seam:

**1.** Write an adapter against the `WeatherProvider` interface
(`src/weather/provider.ts`):

```ts
export const myApiProvider: WeatherProvider = {
  id: 'my-api',
  label: 'My API',
  async searchPlaces(query, signal) { /* -> Place[] */ },
  async reverseGeocode(coords, signal) { /* -> Place */ },
  async getSnapshot(place, signal) { /* -> WeatherSnapshot */ },
};
```

**2.** Change one line in `src/weather/index.ts`:

```ts
export const weatherProvider: WeatherProvider = myApiProvider;
```

That is the whole change. Nothing else imports the provider.

**Mapping helpers are already written.** `src/weather/condition-codes.ts` maps
WMO 4677 codes (Open-Meteo, DWD, most national services), OpenWeatherMap
condition IDs, and free-text summaries onto the app's `WeatherCondition`
vocabulary — usually the fiddliest part of an adapter.

`WeatherSnapshot` (`src/weather/types.ts`) is the target shape. Temperatures are
**always Celsius** in the model; conversion happens at the render edge, so an
adapter never has to know the user's unit preference.

---

## Place search

Search resolves in two layers:

1. **`src/weather/directory.ts`** — a bundled list, covering India down to
   district towns plus major world cities. Instant, and works with no network.
2. **`src/weather/geocoding.ts`** — Open-Meteo's geocoding service for anything
   not bundled. Free, **no API key**, and it indexes small localities worldwide.

Both layers are needed. Open-Meteo has Nagercoil but returns *nothing* for
Kanyakumari, which is why the bundled list is not just a cache.

Geocoding is used **only to resolve place names** — weather always comes from
`weatherProvider`. Set `ONLINE_GEOCODING = false` in `geocoding.ts` to make the
app fully offline; search then falls back to the bundled directory alone. Any
network failure already degrades to that silently.

### Weather for arbitrary places

The mock generates data for *any* `Place`, not just ones it knows. Climate is
derived from latitude (a fitted curve, not a straight line — flat across the
tropics, falling away sharply toward the poles), season, hemisphere, and
**elevation** at 5.5°C/km.

Elevation is what makes Ooty read 17°C instead of 28°C. Checked against real
late-July means, the model lands within ~2°C for Chennai, Nagercoil, Bengaluru,
Darjeeling, Kodaikanal, London, Oslo, Melbourne and Sydney. It does not model
continentality, so hot inland plains such as Delhi read a few degrees cool.

---

## Layout

```
src/
  app/               Routes: index (Today), cities, sky
  sky/
    palettes.ts      Gradient matrix, per condition x day/night
    derive.ts        Snapshot -> SkyState, and the layer recipe per condition
    sky-background.tsx   Composes a scene; cross-fades between two of them
    layers/
      precipitation.tsx  rain, snow, sleet, hail
      clouds.tsx         cumulus masses, fog banks
      celestial.tsx      sun, rays, stars, moon
      effects.tsx        lightning, rumble, shimmer, ripples, wet glass,
                         city lights, frost, gusts, dust
  weather/
    provider.ts      The adapter interface  <- the seam
    mock-provider.ts Deterministic mock data
    solar.ts         Sunrise/sunset from latitude and date
  components/        Hero, hourly ribbon, forecast list, metrics, tab dock
  design/tokens.ts   Spacing, glass, type scale, temperature ramp
```

### Adding a condition

1. Add it to `WeatherCondition` and `CONDITION_LABEL` in `weather/types.ts`.
2. Add a day and night palette in `sky/palettes.ts` — golden hour is handled
   generically by `HORIZON_GLOW`, so two entries is all it needs.
3. Add a case to `getSkyRecipe` in `sky/derive.ts` listing its layers.
4. Add a glyph in `components/weather-icon.tsx`.

It appears in the Sky screen's picker automatically.

---

## Notes

- Clouds are masses of overlapping puffs, each filled with a **radial gradient
  that fades to fully transparent at its rim**. That detail is the whole
  component: a puff drawn as a flat semi-transparent disc has a hard edge, and a
  field of hard edges reads as a heap of soap bubbles. With the alpha falling
  off smoothly there is no rim to see, so the puffs merge into one mass and only
  their accumulated density shows. Shortening the gradient's tail brings the
  bubbles straight back.
- Sun and moon are positioned on a real arc computed from latitude and date
  (`weather/solar.ts`), so golden hour happens at the horizon and the moon shows
  its actual phase.
- Lightning flashes and the screen rumble share a `STORM_PERIOD_MS` constant and
  derive their keyframes from it, so they stay synchronised with no JS timer.
  Two flash tracks with different periods drift in and out of phase, so the
  storm never visibly loops.
- City clocks use offset arithmetic rather than `Intl.DateTimeFormat`, whose ICU
  coverage varies by Hermes build — a city clock silently falling back to device
  time is a bug nobody reports but everybody feels.
- Turning off **Animations** on the Sky screen renders a still frame of every
  layer rather than removing them.

## Scripts

| Command | Purpose |
| --- | --- |
| `npx expo start` | Run in development |
| `npx tsc --noEmit` | Typecheck |
| `npx expo lint` | Lint |
| `npx expo export --platform ios --platform android` | Verify the bundle builds |
