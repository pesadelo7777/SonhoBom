// src/utils/helpers.ts

export const b64Encode = (str: string): string => {
    return Buffer.from(str, 'utf8').toString('base64');
};

export const b64Decode = (str: string): string => {
    return Buffer.from(str, 'base64').toString('utf8');
};

// Interface visual do Terminal Deus-Seven
export const Color = {
    Red: "\x1b[31m",
    Green: "\x1b[32m",
    Cyan: "\x1b[36m",
    Yellow: "\x1b[33m",
    Gray: "\x1b[90m",
    Reset: "\x1b[0m"
};