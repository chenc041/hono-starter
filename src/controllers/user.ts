export class UserController {
  constructor(public name: string) {}

  async register() {
    console.log("register");
    return Promise.resolve(this.name);
  }
}
