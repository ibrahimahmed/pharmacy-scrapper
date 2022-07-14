const getReadableTimestamp = () => {
    const d = new Date();
    return `${d.getFullYear()}_${d.getMonth() + 1}_${d.getDate()}_${d.getHours()}_${d.getMinutes()}_${d.getSeconds()}`;
}

module.exports = getReadableTimestamp;