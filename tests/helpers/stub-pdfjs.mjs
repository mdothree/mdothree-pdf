export default {
  GlobalWorkerOptions: {},
  getDocument: (...a) => globalThis.__pdfjs.getDocument(...a),
};
