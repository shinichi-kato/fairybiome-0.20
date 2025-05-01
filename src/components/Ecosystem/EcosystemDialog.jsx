/*
EcosystemDialog
==============================

日付時刻を固定値にする

*/

import React, { useReducer } from 'react';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';

import * as ecosystem from './ecosystem';

function DateSlider({ state, handleChangeDays }) {

  return (
    <Grid container spacing={2}>
      <Grid size={8}>
        <Slider
          alia-label="daySlider"
          disabled={state.disabled}
          max={364}
          min={1}
          value={state.days}
          onChange={handleChangeDays}
        />
      </Grid>
      <Grid size={4}>
        {`${('00' + state.month).slice(-2)}/${('00' + state.date).slice(-2)}`}
      </Grid>
    </Grid>
  )
}

function MinutesSlider({ state, handleChangeMinutes }) {

  return (
    <Grid container spacing={2}>
      <Grid size={8}>
        <Slider
          alia-label="minuteSlider"
          disabled={state.disabled}
          max={23 * 60 + 59}
          min={1}
          value={state.minutes}
          onChange={handleChangeMinutes}
        />
      </Grid>
      <Grid size={4}>
        {`${('00' + state.hour).slice(-2)}:${('00' + state.minute).slice(-2)}`}
      </Grid>
    </Grid>
  )
}

function WeatherSlider({ state, handleChangeBaro }) {
  return (
    <Grid container spacing={2}>
      <Grid size={8}>
        <Slider
          alia-label="minuteSlider"
          disabled={state.disabled}
          max={7}
          min={0}
          step={1}
          value={state.baro}
          onChange={handleChangeBaro}
        />
      </Grid>
      <Grid size={4}>
        {state.weather}
      </Grid>
    </Grid>
  )
}

const initialState = {
  disabled: true,
  days: 1,
  minutes: 1,
  baro: 0,
  weather: 'SNOWY',
  month: 1,
  date: 1,
  hour: 0,
  minute: 0
}

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_DISABLED': {
      return {
        ...state,
        disabled: action.disabled
      }
    }

    case 'CHANGE_DAYS': {
      let weather;
      if (state.month !== action.month) {
        weather = ecosystem.WEATHER_MAP[action.month - 1][state.baro]
      } else {
        weather = state.weather;
      }

      return {
        ...state,
        days: action.days,
        month: action.month,
        date: action.date,
        weather: weather,
      }
    }

    case 'CHANGE_MINUTES': {


      return {
        ...state,
        minutes: action.minutes,
        hour: action.hour,
        minute: action.minute
      }
    }

    case 'CHANGE_BARO': {
      return {
        ...state,
        baro: action.baro,
        weather: ecosystem.WEATHER_MAP[state.month - 1][action.baro]
      }
    }
    default:
      throw new Error(`invalid action ${action}`);
  }
}

export default function EcosystemDialog({ uid, ecoState, handleCloseDialog }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  if (!state.days && ecoState.month) {

  }

  function handleToggleDisabled() {
    const disabled = !state.disabled;
    ecosystem.DB.fixedFeature.update(uid, { disabled: disabled });
    dispatch({ type: "TOGGLE_DISABLED", disabled: disabled });
  }

  function handleChangeDays(event, newValue) {
    const d = new Date();
    d.setMonth(0);
    d.setDate(newValue);
    const month = d.getMonth() + 1;
    const date = d.getDate();

    ecosystem.DB.fixedFeature.update(uid, { month: month, date: date }).then();
    dispatch({ type: 'CHANGE_DAYS', days: newValue, month: month, date: date });
  }

  function handleChangeMinutes(event, newValue) {
    const d = new Date();
    d.setHours(0);
    d.setMinutes(newValue);
    const hour = d.getHours();
    const minute = d.getMinutes();

    ecosystem.DB.fixedFeature.update(uid, { hour: hour, minute: minute }).then();
    dispatch({ type: 'CHANGE_MINUTES', minutes: newValue, hour: hour, minute: minute });
  }

  function handleChangeBaro(event, newValue) {
    dispatch({ type: 'CHANGE_BARO', baro: newValue });
  }

  return (
    <Container sx={{ pt: 5 }}

    >
      <Paper elevation={4}
        sx={{ p: 2, width: "70%", mx: "auto" }}
      >
        <Stack>
          <FormControlLabel control={<Switch
            checked={!state.disabled}
            onChange={handleToggleDisabled}
          />}
            label="日時・天候を固定する"
          />

          <Typography>日付</Typography>
          <DateSlider
            state={state}
            handleChangeDays={handleChangeDays}
          />
          <Typography>時刻</Typography>
          <MinutesSlider
            state={state}
            handleChangeMinutes={handleChangeMinutes}
          />
          <Typography>天候</Typography>
          <WeatherSlider
            state={state}
            handleChangeBaro={handleChangeBaro}
          />
          <Button
            variant="contained"
            onClick={handleCloseDialog}
          >
            閉じる
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}