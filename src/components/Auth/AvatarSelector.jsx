import React from 'react';

import ImageList from '@mui/material/ImageList';
import ImageListItem from '@mui/material/ImageListItem';

export default function AvatarSelector({ avatarDir, avatarDirs, handleChangeAvatarDir }) {
  if(avatarDir === ''){
    avatarDir = 'unknown_user';
  }
  return (
    <ImageList sx={{ width: 300, height: 170 }} cols={3} rowHeight={164}>
      {avatarDirs.map((dir) => (
        <ImageListItem key={dir}
          onClick={()=>{handleChangeAvatarDir(dir)}}
          sx={{
            border: dir === avatarDir ? "4px solid" : "none",
            borderColor: 'primary.main' 
          }}
        >
          <img
            src={`../../avatar/user/${dir}/peace.svg`}
            alt={dir}
            style={{
              width: 120,
              height: 180
            }}
            loading="lazy"
          />
        </ImageListItem>
      ))}
    </ImageList>
  );
}