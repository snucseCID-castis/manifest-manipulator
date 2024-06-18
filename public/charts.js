document.addEventListener("DOMContentLoaded", () => {
	const socket = io();

	socket.on("connect", () => {
		console.log("Connected to server");
	});

	const costCtx = document.getElementById("costChart").getContext("2d");
	const C1ConnCtx = document.getElementById("C1ConnChart").getContext("2d");
	const C1DelayCtx = document.getElementById("C1DelayChart").getContext("2d");
	const C2ConnCtx = document.getElementById("C2ConnChart").getContext("2d");
	const C2DelayCtx = document.getElementById("C2DelayChart").getContext("2d");
	const CFConnCtx = document.getElementById("CFConnChart").getContext("2d");
	const CFDelayCtx = document.getElementById("CFDelayChart").getContext("2d");

	const costChart = createChart(costCtx, "CDN Cost");
	const C1ConnChart = createChart(C1ConnCtx, "[Cache 1] Connections");
	const C1DelayChart = createChart(C1DelayCtx, "[Cache 1] Delay");
	const C2ConnChart = createChart(C2ConnCtx, "[Cache 2] Connections");
	const C2DelayChart = createChart(C2DelayCtx, "[Cache 2] Delay");
	const CFConnChart = createChart(CFConnCtx, "[CloudFront] Connections");
	const CFDelayChart = createChart(CFDelayCtx, "[CloudFront] Delay");

	socket.on("perfLog", (data) => {
		const time = data.time;
		console.log(time);
		updateChart(costChart, data.currentCost, time);
		updateChart(C1ConnChart, data.performanceMap["Cache 1"].clientCount, time);
		updateChart(C1DelayChart, data.performanceMap["Cache 1"].delayCount, time);
		updateChart(C2ConnChart, data.performanceMap["Cache 2"].clientCount, time);
		updateChart(C2DelayChart, data.performanceMap["Cache 2"].delayCount, time);
		updateChart(CFConnChart, data.performanceMap.CloudFront.clientCount, time);
		updateChart(CFDelayChart, data.performanceMap.CloudFront.delayCount, time);
	});

	socket.on("delayLog", (data) => {
		displayText(
			"delayText",
			`User ${data.connection} delayed: Moved to ${data.newCdnName} [${data.time}]`,
		);
	});

	socket.on("downLog", (data) => {
		const downCdnNamesText = data.downCdnNames.join(", ");
		displayText("downText", `CDN ${downCdnNamesText} are down [${data.time}]`);
	});
});

const createChart = (ctx, label) => {
	return new Chart(ctx, {
		type: "line",
		data: {
			labels: [],
			datasets: [
				{
					label: label,
					data: [],
					borderColor: "rgba(75, 192, 192, 1)",
					borderWidth: 1,
					fill: false,
				},
			],
		},
		options: {
			scales: {
				x: {
					type: "time",
					time: {
						unit: "second",
					},
				},
				y: {
					beginAtZero: true,
				},
			},
		},
	});
};

const updateChart = (chart, data, time) => {
	console.log("updateChart: \n", chart.canvas.id, data, time);
	chart.data.labels.push(time);
	chart.data.datasets[0].data.push(data);
	chart.update();
};

const displayText = (elementId, text) => {
	const prefix =
		elementId === "delayText" ? "Connection Delay: " : "Server Down: ";
	document.getElementById(elementId).innerText = prefix + text;
};
