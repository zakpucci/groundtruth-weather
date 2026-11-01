# Groundtruth: the public record

Daily weather forecasts scored against what actually happened.
Scoreboard: <https://zakpucci.github.io/groundtruth-weather/>

The `record` branch holds every issued forecast, committed before the weather it predicts.
`mode: live` files are the real record and are never edited. `mode: hindcast` files were
reconstructed from archived model runs. Check the git history to confirm when each was committed.

Based on data from ECMWF, licensed CC BY 4.0; ECMWF does not accept responsibility for any errors.
NOAA/NWS data is public domain. Climate reports are via the Iowa Environmental Mesonet.
This is an experiment, not an official forecast.
