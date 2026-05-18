import { IUser } from '../models/User';

// Mở rộng kiểu của Express Request để thêm thuộc tính `user`
// Sau khi verifyToken middleware chạy thành công, req.user sẽ có giá trị
declare global {
  namespace Express {
    interface Request {
      user?: Pick<IUser, '_id' | 'email' | 'role' | 'name'> & { id: string };
    }
  }
}
