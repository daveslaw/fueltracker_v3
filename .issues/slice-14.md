## Parent PRD

#2

## What to build

Build the tank level trend chart. Owner selects a station and date range and sees a line chart with one line per tank showing the closing dip reading over time. Useful for visually identifying slow leaks, unusual depletion patterns, or delivery spikes.

## Acceptance criteria

- [ ] Owner can select a station and a date range (presets: last 7 days, last 30 days, custom)
- [ ] Line chart renders one line per tank at the selected station
- [ ] Each data point is the closing dip reading (litres) for that tank on that date
- [ ] Delivery events shown as vertical markers on the chart (date + litres received)
- [ ] Tanks togglable on/off via legend
- [ ] Chart is responsive and readable on mobile
- [ ] Missing data points (no shift submitted for that date) shown as a gap, not zero
- [ ] Capacity line shown per tank as a horizontal reference

## Blocked by

- Blocked by #16 (Slice 12: owner dashboard + daily reports)

## User stories addressed

- User story 42
