import { tmpdir } from 'os';
import { promisify } from 'util';
import { mkdir, writeFile, stat, existsSync, realpath } from 'fs';
import { join as joinPath } from 'path';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { contentType } from 'mime-types';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from '../utils/db';
import { getUserFromXToken } from '../utils/auth';
import Queue from 'bull/lib/queue';

const VALID_FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};
const ROOT_FOLDER_ID = '0';
const DEFAULT_ROOT_FOLDER = 'files_manager';
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const MAX_FILES_PER_PAGE = 20;
const fileQueue = new Queue('thumbnail generation');
const NULL_ID = Buffer.alloc(24, '0').toString('utf-8');

const isValidId = (id) => {
  const size = 24;
  const hexChars = 'abcdefABCDEF0123456789';
  return typeof id === 'string' && id.length === size && [...id].every(char => hexChars.includes(char));
};

export default class FilesController {
  static async postUpload(req, res) {
    const { user } = req;
    const { name, type, parentId = ROOT_FOLDER_ID, isPublic = false, data } = req.body || {};

    if (!name || !Object.values(VALID_FILE_TYPES).includes(type)) {
      res.status(400).json({ error: 'Missing name or invalid type' });
      return;
    }

    if (!data && type !== VALID_FILE_TYPES.folder) {
      res.status(400).json({ error: 'Missing data' });
      return;
    }

    if (!isValidId(parentId)) {
      res.status(400).json({ error: 'Invalid parent ID' });
      return;
    }

    const userId = user._id.toString();
    const baseDir = process.env.FOLDER_PATH?.trim() || joinPath(tmpdir(), DEFAULT_ROOT_FOLDER);

    try {
      await mkDirAsync(baseDir, { recursive: true });

      const newFile = {
        userId: new mongoDBCore.BSON.ObjectId(userId),
        name,
        type,
        isPublic,
        parentId: new mongoDBCore.BSON.ObjectId(parentId),
      };

      if (type !== VALID_FILE_TYPES.folder) {
        const localPath = joinPath(baseDir, uuidv4());
        await writeFileAsync(localPath, Buffer.from(data, 'base64'));
        newFile.localPath = localPath;
      }

      const insertionInfo = await dbClient.filesCollection().insertOne(newFile);
      const fileId = insertionInfo.insertedId.toString();

      if (type === VALID_FILE_TYPES.image) {
        const jobName = `Image thumbnail [${userId}-${fileId}]`;
        fileQueue.add({ userId, fileId, name: jobName });
      }

      res.status(201).json({
        id: fileId,
        userId,
        name,
        type,
        isPublic,
        parentId: parentId === ROOT_FOLDER_ID ? 0 : parentId,
      });
    } catch (error) {
      console.error('Error occurred during file upload:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getShow(req, res) {
    const { user } = req;
    const id = req.params.id || NULL_ID;
    const userId = user._id.toString();

    try {
      const file = await dbClient.filesCollection().findOne({
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(userId),
      });

      if (!file) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
      });
    } catch (error) {
      console.error('Error occurred while fetching file details:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getIndex(req, res) {
    const { user } = req;
    const parentId = req.query.parentId || ROOT_FOLDER_ID;
    const page = parseInt(req.query.page) || 0;

    try {
      const filesFilter = {
        userId: user._id,
        parentId: parentId === ROOT_FOLDER_ID ? parentId : new mongoDBCore.BSON.ObjectId(parentId),
      };

      const files = await dbClient.filesCollection().aggregate([
        { $match: filesFilter },
        { $sort: { _id: -1 } },
        { $skip: page * MAX_FILES_PER_PAGE },
        { $limit: MAX_FILES_PER_PAGE },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: { $cond: { if: { $eq: ['$parentId', '0'] }, then: 0, else: '$parentId' } },
          },
        },
      ]).toArray();

      res.status(200).json(files);
    } catch (error) {
      console.error('Error occurred while fetching files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async togglePublish(req, res, isPublic) {
    const { user } = req;
    const { id } = req.params;
    const userId = user._id.toString();

    try {
      const fileFilter = {
        _id: new mongoDBCore.BSON.ObjectId(isValidId(id) ? id : NULL_ID),
        userId: new mongoDBCore.BSON.ObjectId(userId),
      };

      const file = await dbClient.filesCollection().findOne(fileFilter);

      if (!file) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      await dbClient.filesCollection().updateOne(fileFilter, { $set: { isPublic } });

      res.status(200).json({
        id,
        userId,
        name: file.name,
        type: file.type,
        isPublic,
        parentId: file.parentId === ROOT_FOLDER_ID ? 0 : file.parentId.toString(),
      });
   

