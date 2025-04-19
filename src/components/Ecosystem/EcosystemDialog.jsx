/*
EcosystemDialog
==============================

日付時刻を固定値にする

*/

import React, { useReducer } from 'react';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';

import * as ecosystem from './ecosystem';

function DateSlider({ state, handleChangeDays }) {

  return (
    <Stack direction="row">
      <Slider
        alia-label="daySlider"
        disabled={state.disabled}
        max={365}
        min={1}
        value={state.days}
        onChange={handleChangeDays}
      />
      {`${state.month}/${state.date}`}
    </Stack>

  )
}

function MinutesSlider({state, handleChangeMinutes}){

  return (
    <Stack direction="row">
      <Slider
        alia-label="daySlider"
        disabled={state.disabled}
        max={365}
        min={1}
        value={state.minutes}
        onChange={handleChangeMinutes}
      />
      {`${state.hour}/${state.minute}`}
    </Stack>

  )
}

const initialState = {
  disabled: true,
  days: 1,
  minutes: 1,
  barometer: 1,
  month: 0,
  date: 1,
  hour:0,
  minute:0
}

function reducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_ENABLED': {
      return {
        ...state,
        enabled: !state.disabled
      }
    }

    case 'CHANGE_DAYS': {
      return {
        ...state,
        days: action.days,
        month: action.month,
        date: action.date
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

    default:
      throw new Error (`invalid action ${action}`);
  }
}

export default function EcosystemDialog({ ecoState, handleCloseDialog }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  if(!state.days && ecoState.month){

  }

  function handleChangeDays(days) {
    const d = new Date();
    d.setMonth(1);
    d.setDate(days);
    const month = d.getMonth()+1;
    const date = d.getDate();

    ecosystem.DB.fixedFeature.put({uid:state.uid, month:month,date:date}).then();
    dispatch({ type: 'CHANGE_DAYS', days: days, month:month,date:date});
  }

  function handleChangeMinutes(m){
    const d = new Date();
    d.setHours(0);
    d.setMinutes(state.minutes);
    const hour = d.getHours();
    const minute = d.getMinutes();

    ecosystem.DB.fixedFeature.put({uid:state.uid, hour: hour,minute:minute}).then();
    dispatch({type:'CHANGE_MINUTES',minutes: m, hour:hour,minute:minute});
  }

  return (
    <Paper elevation={4}
      xs={{ width: "80%" }}
    >
      <Stack>
        <Switch label="日時・天候を設定する"
          checked={!state.disabled}
          onChange={() => dispatch({ type: 'TOGGLE_ENABLED' })}
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

      </Stack>
    </Paper>
  )
}