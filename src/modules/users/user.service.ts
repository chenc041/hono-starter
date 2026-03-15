import type { UserRepository } from "~/modules/users/user.repository";
import type { CreateUserInput } from "~/modules/users/user.schema";

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  createUser(input: CreateUserInput) {
    return this.userRepository.create(input);
  }

  listUsers() {
    return this.userRepository.list();
  }
}
