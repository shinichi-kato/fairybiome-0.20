import Dexie from 'dexie';

export class EpisodeStorage {
  constructor(botId) {
    this._db = new Dexie("EpisodeStorage");
    this._db.version(1).stores({
      firestoreSources: "++id,path",
      caches: "botName,partName",
    });
    this.firestore = null;
    this.globalTags = { dict: {} };
  }

  async deploy(botName, firestore){
    this.firestore = firestore;

    const staticFilesJson = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_STATIC_FILES : null;
    if (!staticFilesJson) {
      return;
    }

    let staticFiles;
    try {
      staticFiles = JSON.parse(staticFilesJson);
    } catch (err) {
      console.warn('EpisodeStorage.deploy: failed to parse NEXT_PUBLIC_STATIC_FILES', err);
      return;
    }

    if (!Array.isArray(staticFiles)) {
      return;
    }

    const globalFile = staticFiles.find((entry) =>
      typeof entry === 'string' && (entry === 'tags/global.json' || entry.endsWith('/tags/global.json'))
    );
    if (globalFile) {
      await this.readGlobalTags(globalFile);
    }
  }

  async readGlobalTags(path){
      if (!path) {
        return;
      }

      let response;
      try {
        response = await fetch(path);
      } catch (err) {
        console.warn(`EpisodeStorage.readGlobalTags: failed to fetch "${path}"`, err);
        return;
      }

      if (!response.ok) {
        console.warn(`EpisodeStorage.readGlobalTags: failed to load "${path}" (${response.status})`);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (err) {
        console.warn(`EpisodeStorage.readGlobalTags: invalid JSON in "${path}"`, err);
        return;
      }

      if (!Array.isArray(data)) {
        console.warn(`EpisodeStorage.readGlobalTags: "${path}" must contain an array`);
        return;
      }

      const seenSurface = new Set();
      const normalizedSurfaces = [];

      data.forEach((item, idx) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          console.warn(`EpisodeStorage.readGlobalTags: invalid tag item at index ${idx} in "${path}"`);
          return;
        }

        const { surfaces, embedding } = item;
        if (!Array.isArray(surfaces)) {
          console.warn(`EpisodeStorage.readGlobalTags: tag[${idx}].surfaces must be an array in "${path}"`);
          return;
        }
        if (!embedding || typeof embedding !== 'object' || Array.isArray(embedding)) {
          console.warn(`EpisodeStorage.readGlobalTags: tag[${idx}].embedding must be an object in "${path}"`);
          return;
        }

        const normalizedEmbedding = this._normalizeEmbedding(embedding);
        if (!normalizedEmbedding) {
          console.warn(`EpisodeStorage.readGlobalTags: tag[${idx}].embedding is invalid in "${path}"`);
          return;
        }

        surfaces.forEach((surface) => {
          if (typeof surface !== 'string' || !surface.trim().length) {
            console.warn(`EpisodeStorage.readGlobalTags: invalid surface in tag[${idx}] in "${path}"`);
            return;
          }

          if (seenSurface.has(surface)) {
            console.warn(`EpisodeStorage.readGlobalTags: duplicate surface "${surface}" ignored in "${path}"`);
            return;
          }

          seenSurface.add(surface);
          normalizedSurfaces.push({ surface, embedding: normalizedEmbedding });
        });
      });

      normalizedSurfaces.sort((a, b) => {
        const diff = b.surface.length - a.surface.length;
        return diff !== 0 ? diff : a.surface.localeCompare(b.surface);
      });

      const dict = {};
      normalizedSurfaces.forEach((item, index) => {
        dict[item.surface] = {
          index,
          embedding: item.embedding,
        };
      });

      this.globalTags.dict = dict;
    }

    _normalizeEmbedding(embedding) {
      const entries = Object.entries(embedding).filter(([key, value]) =>
        typeof key === 'string' && key.trim().length > 0 &&
        typeof value === 'number' && !Number.isNaN(value) &&
        value > 0 && value <= 1.0
      );

      const sum = entries.reduce((acc, [, value]) => acc + value, 0);
      if (sum <= 0) {
        return null;
      }

      const normalized = {};
      entries.forEach(([key, value]) => {
        normalized[key] = value / sum;
      });

      return normalized;
    }
}

export function validateTags(data) {
  /*
  [
      {surfaces: [<tag string>,...], embedding: {surface:factor, ...}},
      , ...
  ]
  */
  const errors = [];

  if (!Array.isArray(data)) {
    return ['tags data must be an array'];
  }

  const seenSurface = new Set();

  data.forEach((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`tag[${idx}] must be an object`);
      return;
    }

    if (!Array.isArray(item.surfaces)) {
      errors.push(`tag[${idx}].surfaces must be an array`);
    } else {
      if (item.surfaces.length === 0) {
        errors.push(`tag[${idx}].surfaces must not be empty`);
      }

      item.surfaces.forEach((surface, surfaceIdx) => {
        if (typeof surface !== 'string') {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] must be a string`);
          return;
        }
        if (!surface.trim().length) {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] must not be empty`);
          return;
        }
        if (seenSurface.has(surface)) {
          errors.push(`tag[${idx}].surfaces[${surfaceIdx}] is duplicated across tags: "${surface}"`);
        } else {
          seenSurface.add(surface);
        }
      });
    }

    if (!item.embedding || typeof item.embedding !== 'object' || Array.isArray(item.embedding)) {
      errors.push(`tag[${idx}].embedding must be an object`);
    } else {
      Object.entries(item.embedding).forEach(([key, value]) => {
        if (typeof key !== 'string') {
          errors.push(`tag[${idx}].embedding has invalid key type`);
        }
        if (!key.trim().length) {
          errors.push(`tag[${idx}].embedding contains an empty key`);
        }
        if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push(`tag[${idx}].embedding["${key}"] must be a number`);
        } else if (!(value > 0 && value <= 1.0)) {
          errors.push(`tag[${idx}].embedding["${key}"] must be > 0 and <= 1.0`);
        }
      });
    }
  });

  return errors.length === 0 ? 'ok' : errors;
}

export function validateData(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['data must be an object'];
  }

  if ('title' in data && typeof data.title !== 'string') {
    errors.push('title must be a string');
  }

  if ('author' in data && typeof data.author !== 'string') {
    errors.push('author must be a string');
  }

  if ('tags' in data) {
    const tagsResult = validateTags(data.tags);
    if (tagsResult !== 'ok') {
      tagsResult.forEach((message) => {
        errors.push(`tags.${message}`);
      });
    }
  }

  if (!data.factor || typeof data.factor !== 'object' || Array.isArray(data.factor)) {
    errors.push('factor must be an object');
  } else {
    const { activity, precision } = data.factor;
    if (typeof activity !== 'number' || Number.isNaN(activity)) {
      errors.push('factor.activity must be a number');
    } else if (!(activity > 0 && activity <= 1.0)) {
      errors.push('factor.activity must be > 0 and <= 1.0');
    }

    if (typeof precision !== 'number' || Number.isNaN(precision)) {
      errors.push('factor.precision must be a number');
    } else if (!(precision > 0 && precision <= 1.0)) {
      errors.push('factor.precision must be > 0 and <= 1.0');
    }
  }

  if (!Array.isArray(data.columns)) {
    errors.push('columns must be an array');
  } else if (data.columns.length === 0) {
    errors.push('columns must not be empty');
  } else {
    data.columns.forEach((column, idx) => {
      if (typeof column !== 'string' || !column.trim().length) {
        errors.push(`columns[${idx}] must be a non-empty string`);
      }
    });
  }

  const validRoles = new Set(['bot', 'user', 'eco']);
  const validFacingStrings = new Set(['face', 'back']);
  const validFacingNumbers = new Set([0, Math.PI]);
  const isValidDate = (value) => {
    if (value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    return /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])$/.test(value);
  };
  const isValidTime = (value) => {
    if (value === null || value === '') return true;
    if (typeof value !== 'string') return false;
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value);
  };

  if (!Array.isArray(data.data)) {
    errors.push('data must be an array');
  } else {
    data.data.forEach((row, rowIdx) => {
      if (row === null) {
        return;
      }

      if (typeof row === 'string') {
        if (!row.trim().length) {
          errors.push(`data[${rowIdx}] comment must not be empty`);
        } else if (!row.trimStart().startsWith('#')) {
          errors.push(`data[${rowIdx}] comment must start with "#"`);
        }
        return;
      }

      if (!Array.isArray(row)) {
        errors.push(`data[${rowIdx}] must be null, comment string, or array`);
        return;
      }

      if (!Array.isArray(data.columns) || row.length !== data.columns.length) {
        errors.push(`data[${rowIdx}] length must match columns length (${data.columns ? data.columns.length : 'unknown'})`);
        return;
      }

      const [role, text, date, time, emo, facing, location] = row;
      if (typeof role !== 'string' || !validRoles.has(role)) {
        errors.push(`data[${rowIdx}][0] role must be one of ${Array.from(validRoles).join(', ')}`);
      }
      if (typeof text !== 'string' || !text.trim().length) {
        errors.push(`data[${rowIdx}][1] text must be a non-empty string`);
      }
      if (!isValidDate(date)) {
        errors.push(`data[${rowIdx}][2] date must be "%m/%d" or empty/null`);
      }
      if (!isValidTime(time)) {
        errors.push(`data[${rowIdx}][3] time must be "%H:%M" or empty/null`);
      }
      if (typeof emo !== 'string') {
        errors.push(`data[${rowIdx}][4] emo must be a string`);
      }
      if (facing !== null && facing !== '' && typeof facing !== 'string' && typeof facing !== 'number') {
        errors.push(`data[${rowIdx}][5] facing must be a string or number`);
      } else if (typeof facing === 'string' && !validFacingStrings.has(facing)) {
        errors.push(`data[${rowIdx}][5] facing must be one of ${Array.from(validFacingStrings).join(', ')}`);
      } else if (typeof facing === 'number' && !validFacingNumbers.has(facing)) {
        errors.push(`data[${rowIdx}][5] facing must be 0 or Math.PI`);
      }
      if (location !== null && location !== '' && typeof location !== 'string') {
        errors.push(`data[${rowIdx}][6] location must be a string`);
      }
    });
  }

  return errors.length === 0 ? 'ok' : errors;
}
