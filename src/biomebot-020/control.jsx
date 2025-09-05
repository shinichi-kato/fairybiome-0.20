/*
Control.jsx
=============
チャットボットのモジュール稼働状況をモニタ・操作する。

botModulesはgraphql上のソースをfirestoreにコピーし、それをindexedStorageに
コピーして運用する。Control.jsxではindexedStorage上の各partの状況を表示し、
起動・停止・更新の操作を可能にする。



| name   | part name | status   | src | action            |
|--------|-----------|----------|-----|-------------------|
| Aurula | main      | starting | fs  | start/stop/update |
*/
import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

export default function BotControl({snap}){
  return (

  ) 
}