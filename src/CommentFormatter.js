"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableCommentFormatter = exports.SimpleCommentFormatter = void 0;
class SimpleCommentFormatter {
    format(data) {
        return data.reduce((prev, curr) => prev + `- ${curr.path}: ${curr.users}\n`, "");
    }
}
exports.SimpleCommentFormatter = SimpleCommentFormatter;
class TableCommentFormatter {
    format(data) {
        const header = "|modules|owners|\n|---|---|\n";
        const content = data.reduce((prev, curr) => prev + `| ${curr.path} | ${curr.users.reduce((prev, curr) => prev + '<br>' + curr)} |\n`, "");
        return header + content;
    }
}
exports.TableCommentFormatter = TableCommentFormatter;
