一:
feat: 新增一层得分计算重排层：
1.新增上游渠道权重系数，通过环境变量指定，将score =score * upstream 权重，影响rank结果，设定如下默认值
gemini 1.5
exa :
2. 域名权重，黑白名单模式，黑名单权重为0，白名单域名权重为2，其他为1，域名权重表通过github raw文件 json获取
二：
feat：结果包装层，可筛选score与rank ，只返回前X名 以及 score> x ，两个条件同时满足取交集
