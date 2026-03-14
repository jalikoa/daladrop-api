export class PhoneNumber {
  private readonly value: string;

  constructor(phone: string) {
    this.value = this.normalize(phone);
    this.validate();
  }

  private normalize(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('254')) {
      return digits;
    }
    if (digits.startsWith('0')) {
      return '254' + digits.substring(1);
    }
    if (digits.length === 9) {
      return '254' + digits;
    }
    return digits;
  }

  private validate(): void {
    const kenyanPattern = /^254[17]\d{8}$/;
    if (!kenyanPattern.test(this.value)) {
      throw new Error(`Invalid Kenyan phone number: ${this.value}`);
    }
  }

  toString(): string {
    return this.value;
  }

  toDisplay(): string {
    return `+${this.value.substring(0, 3)} ${this.value.substring(3, 6)} ${this.value.substring(6, 9)} ${this.value.substring(9)}`;
  }

  toJSON(): string {
    return this.value;
  }
}
