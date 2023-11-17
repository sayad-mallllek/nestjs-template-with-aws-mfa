import { BadRequestException, Injectable } from '@nestjs/common';

import { TranslatorService } from '@/integrations/translator/translator.service';
import { hashPass, isPassMatch } from '@/utils/functions/auth.functions';

import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordInput, UpdateUserInput } from './dto/inputs.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translatorService: TranslatorService,
  ) {}

  private async _checkIfEmailExists(email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
      },
    });

    return !!user;
  }

  private async _checkIfOldPasswordIsValid(
    userId: number,
    password: string,
    oldPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (!user) {
      return false;
    }
    return isPassMatch(password, oldPassword);
  }

  private async _updatePassword(userId: number, password: string) {
    const hashedPassword = await hashPass(password);
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        password: hashedPassword,
      },
    });
  }

  async getMe(userId: number) {
    return this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        registrationStep: true,
      },
    });
  }

  async updateMe(input: UpdateUserInput, userId: number) {
    if (input.email && (await this._checkIfEmailExists(input.email)))
      throw new BadRequestException({
        type: 'email_already_exists',
        message: this.translatorService.translate(
          'users.errors.email_already_exists',
        ),
      });
  }

  async changePassword(userId: number, input: ChangePasswordInput) {
    if (
      !(await this._checkIfOldPasswordIsValid(
        userId,
        input.oldPassword,
        input.newPassword,
      ))
    )
      throw new BadRequestException({
        type: 'invalid_old_password',
        message: this.translatorService.translate(
          'users.errors.invalid_old_password',
        ),
      });
    try {
      await this._updatePassword(userId, input.newPassword);
    } catch (error) {
      throw new BadRequestException({
        type: 'update_password_failed',
        message: error.message,
      });
    }
  }
}
