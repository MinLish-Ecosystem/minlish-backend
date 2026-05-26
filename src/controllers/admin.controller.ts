import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import * as adminService from '../services/admin.service';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy danh sách người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 */
export const listUsersController = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const result = await adminService.listUsers(page, limit);
  return sendSuccess(res, 'Users listed', result);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy chi tiết người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết người dùng
 *       404:
 *         description: Không tìm thấy người dùng
 */
export const getUserDetailController = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await adminService.getUserDetail(id);
  return sendSuccess(res, 'User detail', user);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   put:
 *     tags: [Admin]
 *     summary: Khóa tài khoản người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Người dùng đã bị khóa
 */
export const banUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  const reason = req.body.reason;
  if (!reason) throw new AppError('reason required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  await adminService.banUser(adminId, id, reason);
  return sendSuccess(res, 'User banned', null);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/unban:
 *   put:
 *     tags: [Admin]
 *     summary: Mở khóa tài khoản người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Người dùng đã được mở khóa
 */
export const unbanUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await adminService.unbanUser(adminId, id);
  return sendSuccess(res, 'User unbanned', null);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Người dùng đã bị xóa
 */
export const deleteUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await adminService.deleteUser(adminId, id);
  return sendSuccess(res, 'User deleted', null);
});

/**
 * @swagger
 * /api/v1/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy thống kê admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 */
export const getAdminStatsController = catchAsync(async (_req: Request, res: Response) => {
  const stats = await adminService.getAdminStats();
  return sendSuccess(res, 'Admin stats', stats);
});

/**
 * @swagger
 * /api/v1/admin/sets:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy danh sách public sets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách sets
 */
export const listPublicSetsController = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const result = await adminService.listPublicSets(page, limit);
  return sendSuccess(res, 'Public sets', result);
});

/**
 * @swagger
 * /api/v1/admin/sets/{id}/unpublish:
 *   put:
 *     tags: [Admin]
 *     summary: Ẩn public set
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Set đã được ẩn
 */
export const unpublishSetController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  const reason = req.body.reason;
  await adminService.unpublishSet(adminId, id, reason);
  return sendSuccess(res, 'Set unpublished', null);
});

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy audit logs của admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Danh sách audit logs
 */
export const getAuditLogsController = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  const result = await adminService.getAuditLogs(page, limit);
  return sendSuccess(res, 'Audit logs', result);
});
