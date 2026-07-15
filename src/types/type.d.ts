import type { JwtUserPayload } from '../utils';
import type { User as UserEntity } from '../modules/user/entities/user.entity';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends JwtUserPayload {}

    interface Request {
      user?: User | UserEntity;
    }
  }
}
